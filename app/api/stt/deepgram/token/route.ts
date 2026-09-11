import { NextResponse } from "next/server";
import { DeepgramClient } from "@deepgram/sdk";
import { createClient as createServerClient } from "@/lib/supabase-server";
import dns from "node:dns";

// Force Node.js to prefer IPv4
dns.setDefaultResultOrder("ipv4first");

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing DEEPGRAM_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const supabase = await createServerClient();
    let {
      data: { user },
    } = await supabase.auth.getUser();

    // Support Bearer token authentication in addition to cookie session
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

    try {
      const client = new DeepgramClient({ apiKey });
      const result = await client.auth.v1.tokens.grant();
      if (result?.access_token) {
        return NextResponse.json(
          { key: result.access_token },
          { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" } }
        );
      }
    } catch {
      // Standard project keys do not support auth.v1.tokens.grant; use the authorized key
    }

    return NextResponse.json(
      { key: apiKey },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" } }
    );
  } catch (error) {
    console.error("Deepgram token error:", error);
    return NextResponse.json({ error: "Failed to authenticate with Deepgram" }, { status: 500 });
  }
}
