import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GLADIA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GLADIA_API_KEY. Add your Gladia API key to .env and restart the server." },
      { status: 500 },
    );
  }

  const payload = {
      encoding: "wav/pcm",
      bit_depth: 16,
      sample_rate: 16000,
      channels: 1,
      model: "solaria-1",
      endpointing: 0.3,
      maximum_duration_without_endpointing: 8,
      language_config: {
        languages: ["en"],
        code_switching: false,
      },
      pre_processing: {
        audio_enhancer: true,
        speech_threshold: 0.55,
      },
      realtime_processing: {
        custom_vocabulary: true,
        custom_vocabulary_config: {
          vocabulary: [
            "hepatomegaly",
            "cholelithiasis",
            "gallstones",
            "hydronephrosis",
            "splenomegaly",
            "echogenicity",
            "common bile duct",
            "CBD",
            "thyroid",
            "TI-RADS",
          ],
        },
        custom_spelling: false,
        translation: false,
        named_entity_recognition: false,
        sentiment_analysis: false,
      },
      post_processing: {
        summarization: false,
        chapterization: false,
      },
      messages_config: {
        receive_partial_transcripts: true,
        receive_final_transcripts: true,
        receive_speech_events: true,
        receive_pre_processing_events: false,
        receive_realtime_processing_events: true,
        receive_post_processing_events: false,
        receive_acknowledgments: false,
        receive_errors: true,
        receive_lifecycle_events: true,
      },
      callback: false,
    };

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    response = await fetch("https://api.gladia.io/v2/live", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gladia-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.name === "AbortError" ? "Gladia session setup timed out" : error instanceof Error ? error.message : "Gladia request failed" },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: (await response.text()) || response.statusText },
      { status: response.status },
    );
  }

  return NextResponse.json(await response.json());
}
