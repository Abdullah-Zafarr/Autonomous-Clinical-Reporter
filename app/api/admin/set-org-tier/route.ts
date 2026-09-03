import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { isUserSuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/set-org-tier
 * Body: { orgId: string, tier: "individual" | "professional" | "enterprise" }
 * Callable by Super Admins. Enforced server-side.
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

    const devBypass =
      process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

    const superAdmin = devBypass || (await isUserSuperAdmin(user, serviceSb));
    if (!superAdmin) {
      return NextResponse.json({ error: "Forbidden — super admin only" }, { status: 403 });
    }

    const body = await request.json();
    const { orgId, tier } = body as { orgId: string; tier: string };

    if (!orgId || !["individual", "professional", "enterprise"].includes(tier)) {
      return NextResponse.json({ error: "Invalid orgId or tier" }, { status: 400 });
    }

    const { data, error } = await serviceSb
      .from("organizations")
      .update({ tier })
      .eq("id", orgId)
      .select("id, name, tier")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, org: data });
  } catch (err: any) {
    console.error("[set-org-tier] error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
