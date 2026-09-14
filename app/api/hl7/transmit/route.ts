import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const db = await createClient();
    let { data: { user } } = await db.auth.getUser();

    if (!user) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        const { data: bearerUser } = await db.auth.getUser(token);
        if (bearerUser?.user) {
          user = bearerUser.user;
        }
      }
    }

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (process.env.ENABLE_HL7_DEMO === "false") {
      return NextResponse.json({ error: "Configure a real HL7 gateway before sending reports." }, { status: 503 });
    }

    const body = await req.json();
    if (typeof body.payload !== "string" || !body.payload.trim() || body.payload.length > 100000) {
      return NextResponse.json({ error: "Invalid HL7 payload" }, { status: 400 });
    }

    // In a real scenario, this would send to an MLLP gateway or an external EHR integration.
    // For local development and demo environments, acknowledge receipt.
    return NextResponse.json({
      status: "success",
      mock: true,
      messageId: `MOCK-${Date.now()}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[HL7-MOCK] Failed to process request:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
