import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Missing DEEPGRAM_API_KEY" }, { status: 500 });
  }

  try {
    const supabase = await createServerClient();
    let {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        const { data: bearerUser } = await supabase.auth.getUser(token);
        if (bearerUser?.user) {
          user = bearerUser.user;
        }
      }
    }

    const isDev = process.env.NODE_ENV === "development";
    const devBypass = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

    if (!user && !devBypass && !isDev) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    let audioBuffer: Buffer;
    let mimeType = "audio/wav";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("audio") || formData.get("file");
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: "Missing audio file in form data" }, { status: 400 });
      }
      mimeType = file.type || "audio/webm";
      const arrayBuffer = await file.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
    } else {
      const arrayBuffer = await request.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
      mimeType = contentType || "audio/wav";
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json({ error: "Empty audio payload" }, { status: 400 });
    }

    const deepgramUrl =
      "https://api.deepgram.com/v1/listen?model=nova-2-medical&smart_format=true&punctuate=true";

    const response = await fetch(deepgramUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": mimeType,
      },
      body: new Uint8Array(audioBuffer),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[STT Transcribe] Deepgram REST error:", response.status, errText);
      return NextResponse.json({ error: "Transcription service error" }, { status: response.status });
    }

    const data = await response.json();
    const transcript =
      data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";

    return NextResponse.json({ transcript, metadata: data.metadata });
  } catch (error) {
    console.error("[STT Transcribe] Exception:", error);
    return NextResponse.json({ error: "Internal server error during transcription" }, { status: 500 });
  }
}
