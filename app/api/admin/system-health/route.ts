import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isSuperAdmin = user?.email?.toLowerCase() === process.env.SUPER_ADMIN_EMAIL?.toLowerCase();

    if (!user || !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden: super admin role required" }, { status: 403 });
    }

    const payload = {
      supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      supabaseServiceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      dicomwebConfigured: Boolean(process.env.NEXT_PUBLIC_DICOMWEB_API_URL),
      hl7ExportConfigured: Boolean(process.env.NEXT_PUBLIC_HL7_EXPORT_API_URL),
      reportApiConfigured: Boolean(process.env.NEXT_PUBLIC_REPORT_API_URL),
      gladiaApiConfigured: Boolean(process.env.DEEPGRAM_API_KEY || process.env.GLADIA_API_KEY),
      deepgramConfigured: Boolean(process.env.DEEPGRAM_API_KEY),
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
    };

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}
