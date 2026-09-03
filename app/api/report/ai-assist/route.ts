import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient as createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    let {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        const { data: bearerUser } = await supabase.auth.getUser(token);
        if (bearerUser?.user) {
          user = bearerUser.user;
        }
      }
    }

    const devBypass =
      process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

    if (!user && !devBypass) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GROQ_API_KEY. Please configure it in your environment." },
        { status: 500 }
      );
    }

    const isGroq = Boolean(process.env.GROQ_API_KEY);
    const aiClient = new OpenAI({
      apiKey,
      baseURL: isGroq ? "https://api.groq.com/openai/v1" : undefined,
    });

    const candidateModels: string[] = isGroq
      ? [process.env.GROQ_MODEL, "openai/gpt-oss-120b", "openai/gpt-oss-20b", "groq/compound-mini"].filter(
          Boolean
        ) as string[]
      : [process.env.OPENAI_MODEL || "gpt-4o-mini"];

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { rawFindings, examType = "Ultrasound", patientInfo = {}, existingReportText = "" } = body;

    if (!rawFindings || typeof rawFindings !== "string" || !rawFindings.trim()) {
      return NextResponse.json(
        { error: "Clinical findings or dictation text is required." },
        { status: 400 }
      );
    }

    const systemPrompt = `
You are an expert ACR (American College of Radiology) Certified Clinical Scribe and Transcriptionist.
Your duty is to assist the interpreting physician by transforming their raw dictation, measurements, and ultrasound findings into a formal, professional radiological report.

### CRITICAL SAFETY & REGULATORY GUARDRAILS:
1. STRICT SCRIBE SCOPE: You are an administrative clinical transcription tool. You must NEVER formulate new diagnoses independently, suggest medical treatments, prescribe medications, or give medical advice.
2. PRESERVE PHYSICIAN INTENT: Transcribe only the anatomy, measurements, and impressions explicitly mentioned or implied by the doctor. NEVER hallucinate pathologies, masses, or numbers not stated.
3. CONCISE & OBJECTIVE: Maintain objective, medicolegal ultrasound documentation terminology (e.g. "normal in size and caliber", "no focal echogenic focus with shadowing", "homogeneously normal echotexture").
4. FORMATTING STRUCTURE:
   Format the response strictly with the following clear ACR sections:
   
   CLINICAL INDICATION: [Indication or 'Evaluation of clinical symptoms']
   TECHNIQUE: Real-time gray scale and color Doppler ultrasound examination of the ${examType}.
   COMPARISON: None available.

   FINDINGS:
   [Detailed, paragraph or organ-by-organ breakdown based directly on the doctor's observations and measurements]

   IMPRESSION:
   1. [Numbered list summarizing the key positive or pertinent negative findings]
   2. [Second finding if applicable]
`;

    const userPrompt = `
Exam Type: ${examType}
Patient: ${patientInfo.lastName || "Patient"}, ${patientInfo.firstName || ""} (MRN: ${patientInfo.mrn || "N/A"})
Existing Draft Context (if any):
${existingReportText ? existingReportText.slice(0, 500) : "None"}

Physician's Dictation / Raw Measurements:
"""
${rawFindings.trim()}
"""

Generate the formal clinical ultrasound report now following the ACR guidelines above. Do not include markdown code fence blocks like \`\`\`markdown, return the clean formatted text directly.
`;

    let generatedReport: string | null = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const completion = await aiClient.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.15,
          max_tokens: 1200,
        });

        const content = completion.choices[0]?.message?.content?.trim();
        if (content) {
          generatedReport = content.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
          break;
        }
      } catch (err) {
        console.warn(`[ai-assist] Model ${model} failed, trying next:`, (err as any)?.message);
        lastError = err;
      }
    }

    if (!generatedReport) {
      // Safe fallback if AI service is temporarily unavailable: create formatted draft directly
      const fallbackReport = `EXAM: ${examType.toUpperCase()} ULTRASOUND\n\nFINDINGS:\n${rawFindings.trim()}\n\nIMPRESSION:\n1. Findings as detailed above.`;
      return NextResponse.json({
        reportText: fallbackReport,
        modelUsed: "local-fallback",
        warning: lastError?.message || "AI model unavailable, structured fallback generated.",
      });
    }

    return NextResponse.json({
      reportText: generatedReport,
      status: "success",
    });
  } catch (error: any) {
    console.error("[ai-assist] Error generating draft:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error generating report." },
      { status: 500 }
    );
  }
}
