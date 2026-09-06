import { NextResponse } from "next/server";
import OpenAI from "openai";
import { reportSectionsSchema } from "@/lib/report-schema";
import { createClient as createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
    false;

  if (!user && !devBypass) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GROQ_API_KEY or OPENAI_API_KEY. Please add it to your .env file." },
      { status: 500 }
    );
  }

  const isGroq = Boolean(process.env.GROQ_API_KEY);
  const aiClient = new OpenAI({
    timeout: 12000,
    maxRetries: 0,
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

  const { exam, localReport, worksheet, thyroid, ob, vascular, additionalNotes } = body;
  const validatedReport = reportSectionsSchema.safeParse(localReport);
  if (!validatedReport.success || JSON.stringify(body).length > 60000) return NextResponse.json({ error: "Invalid or oversized report" }, { status: 400 });
  const allowedExams = new Set(["Abdomen", "Thyroid", "OB", "Vascular"]);
  const examLabel = allowedExams.has(exam) ? exam : "Abdomen";

  const systemPrompt = `
You are an expert Radiologist. Your task is to take a draft ultrasound report and its structured findings, and polish it into a professional, clear, and highly accurate clinical report.

### GUIDELINES:
1. **Professionalism**: Use formal medical terminology.
2. **Clarity**: Ensure findings are presented logically.
3. **Impression**: The impression should be a concise summary of the most important findings. Use a numbered list if there are multiple points.
4. **Consistency**: Ensure the text matches the structured data provided.
38. **Additional Notes (CRITICAL)**: Treat the "Additional Notes" section as authoritative clinical observations. You MUST NOT summarize them away or omit any information provided there.
39. **Formatting Miscellaneous Notes**: If the "Additional Notes" contain data that cannot be logically merged into standard categories (like Abdomen or Vascular), you MUST create a distinct section titled "Additional Clinical Observations" or "Miscellaneous Findings" at the end of the Findings block.
40. **Scope (CRITICAL)**: Only report on the anatomy and sections provided in the Input Data. If a section or organ is not explicitly mentioned or has null data, do not include it in your output. Do not assume 'normal' for unmentioned anatomy.
41. **No Placeholders**: Do not include phrases like "as described above" or "see below".

### OUTPUT FORMAT:
Return ONLY a JSON object with the following structure:
{
  "report": {
    "findings": ["Finding 1", "Finding 2", ...],
    "impression": ["Impression 1", "Impression 2", ...],
    "recommendations": ["Recommendation 1", ...] (optional)
  }
}
`;
  const userPrompt = JSON.stringify({
    exam: examLabel,
    localReport: validatedReport.data,
    worksheet,
    thyroid,
    ob,
    vascular,
    additionalNotes: typeof additionalNotes === "string" ? additionalNotes : "",
  });

  for (const model of [...new Set(candidateModels)].slice(0, 2)) {
    try {
      const response = await aiClient.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1000,
      });

      const raw = response.choices[0].message.content || "{}";
      const result = JSON.parse(raw);

      const validated = reportSectionsSchema.safeParse(result?.report);
      if (validated.success && response.choices[0]?.finish_reason === "stop") {
        return NextResponse.json({ report: validated.data });
      }
    } catch (modelErr: any) {
      console.warn(`[report-generate] model ${model} failed, trying fallback:`, modelErr?.message || modelErr);
    }
  }

  // Graceful fallback to local report rather than crashing clinical workflow
  console.info("[report-generate] Falling back to local structured clinical report");
  return NextResponse.json({
    report: validatedReport.data,
    warning: "AI polish unavailable; structured clinical findings preserved.",
  });
}
