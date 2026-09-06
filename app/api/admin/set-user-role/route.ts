import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { isUserSuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/set-user-role
 * Body: { userId: string, role: "doctor" | "sonographer" | "radiologist" | "admin" }
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
      false;

    const superAdmin = devBypass || (await isUserSuperAdmin(user, serviceSb));
    if (!superAdmin) {
      return NextResponse.json({ error: "Forbidden — super admin only" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role } = body as { userId: string; role: string };

    const validRoles = ["doctor", "sonographer", "radiologist", "admin"];
    if (!userId || !validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid userId or role" }, { status: 400 });
    }

    // 1. Update profiles table
    const { data: profData, error: profErr } = await serviceSb
      .from("profiles")
      .update({ role })
      .eq("id", userId)
      .select("id, email, role, first_name, last_name")
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }
    if (!profData) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

    // 2. Sync user_roles table
    const removed = await serviceSb.from("user_roles").delete().eq("user_id", userId).neq("role", role);
    if (removed.error) return NextResponse.json({ error: "Role change incomplete: old permissions could not be removed. Retry the role change." }, { status: 500 });
    const assigned = await serviceSb.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
    if (assigned.error) return NextResponse.json({ error: "Role change incomplete: permission assignment failed. Retry the role change." }, { status: 500 });

    return NextResponse.json({ success: true, profile: profData });
  } catch (err: any) {
    console.error("[set-user-role] error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
