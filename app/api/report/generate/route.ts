import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient as createServerClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
    apiKey,
    baseURL: isGroq ? "https://api.groq.com/openai/v1" : undefined,
  });
  const aiModel = isGroq
    ? (process.env.GROQ_MODEL || "llama-3.3-70b-versatile")
    : (process.env.OPENAI_MODEL || "gpt-4o-mini");

  try {
    const body = await req.json();
    const { exam, localReport, worksheet, thyroid, ob, vascular, additionalNotes } = body;

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

### INPUT DATA:
- **Exam Type**: ${exam}
- **Local Findings**: ${JSON.stringify(localReport.findings)}
- **Local Impression**: ${JSON.stringify(localReport.impression)}
- **Worksheet Data**: ${JSON.stringify({ worksheet, thyroid, ob, vascular })}
- **Additional Notes**: ${additionalNotes}

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

    const response = await aiClient.chat.completions.create({
      model: aiModel,
      messages: [
        { role: "system", content: systemPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    if (!result.report) {
       throw new Error("Invalid response format from AI");
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json({ error: "Failed to generate enhanced report" }, { status: 500 });
  }
}
