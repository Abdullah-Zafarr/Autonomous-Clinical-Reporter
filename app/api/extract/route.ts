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
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const currentState = body?.currentState ?? {};
    const currentExam = typeof body?.currentExam === "string" ? body.currentExam : "Abdomen";

    if (!text) {
      return NextResponse.json({ error: "Missing dictated text." }, { status: 400 });
    }

    const systemPrompt = `
You are an expert Radiology Assistant. Your task is to extract clinical findings from a dictated text and update a structured ultrasound worksheet.
The worksheet has 4 main categories: Abdomen, Thyroid, OB, and Vascular.

### SCHEMA:
The worksheet structure (WorksheetData) is as follows:
- Abdomen: { liver: { size, echotexture, surface, focalLesions }, gallbladder: { wallThickness, content, murphysSign }, biliary: { cbd, intrahepatic }, kidneys: { rightLength, leftLength, corticalEchogenicity, hydronephrosis, stones }, spleen: { size, echotexture }, pancreas: { visualized, echotexture, ductMm }, vessels: { portalVeinMm, aortaState, aortaMaxApCm, ivcState }, ascites: { volume } }
- Thyroid: { rightLobe: { length, width, depth }, leftLobe: { length, width, depth }, isthmus, parenchyma, vascularity, cervicalNodes, nodules: [] }
- OB: { gestationalAge, fetalHeartRate, presentation, placentaLocation, amnioticFluid, biometryNotes, impression }
- Vascular: { vesselExamined, laterality, flowPatency, stenosisFindings, thrombusPresence, waveformNotes, impression }

### INSTRUCTIONS:
1. Identify which category or categories the findings belong to.
2. **STRICT EXCLUSION (CRITICAL)**: Update ONLY the fields that were EXPLICITLY mentioned in the dictation.
3. **NO ASSUMPTIONS**: NEVER return data for an organ or field as "Normal", "Clear", or "None" unless the user explicitly stated it was normal.
4. If the user only provides general notes, your response should ONLY contain the "additionalNotes" field and NO abdomen/thyroid/ob/vascular keys.
5. Normalize measurements (e.g., "14 centimeters" -> "14", "3 millimeters" -> "3").
5. Map descriptive findings to the nearest valid enum value if applicable:
   - Liver Echotexture: "Homogeneous", "Diffusely echogenic (fatty infiltration)", "Coarse"
   - Gallbladder Content: "Clear", "Sludge", "Gallstones"
   - Duct State: "Normal", "Dilated"
   - Hydronephrosis: "None", "Mild", "Moderate", "Severe"
   - Kidney Stones: "None", "Right", "Left", "Bilateral"
   - Thyroid Parenchyma: "Homogeneous", "Mildly heterogeneous", "Markedly heterogeneous"
   - OB Presentation: "Cephalic", "Breech", "Transverse", "Variable"
   - Vascular Flow: "Patent", "Partially occluded", "Occluded"

### OUTPUT:
Return a JSON object containing the updated fields. 
The object should have the same structure as the worksheet sections (e.g., { abdomen: { ... }, thyroid: { ... } }).
Crucially, if there is any text in the dictation that does NOT logically map to a specific box in the schema above (e.g. general observations, clinical context, or findings for organs not listed), you MUST include that text in a top-level "additionalNotes" string field in your response.
Example: { "abdomen": { "liver": { "size": "14" } }, "additionalNotes": "Patient was cooperative but had significant bowel gas." }

### ACTIVE EXAM TYPE:
${currentExam}

### CURRENT STATE:
${JSON.stringify(currentState)}

### DICTATED TEXT:
"${text}"
`;

    const response = await aiClient.chat.completions.create({
      model: aiModel,
      messages: [
        { role: "system", content: systemPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 800,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return NextResponse.json(result);
  } catch (error) {
    console.error("Extraction error:", error);
    return NextResponse.json({ error: "Failed to extract findings" }, { status: 500 });
  }
}
