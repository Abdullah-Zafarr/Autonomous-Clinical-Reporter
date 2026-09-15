import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/clear-failed-hl7
 * Deletes failed HL7 messages for the user's organization (or all if super admin).
 */
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const serviceSb = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  }) as any;

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

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const orgId = body.organizationId;
    let query = serviceSb.from("hl7_messages").delete().eq("status", "failed");
    if (orgId) {
      query = query.eq("organization_id", orgId);
    }

    const { data, error } = await query.select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedCount: data?.length ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
