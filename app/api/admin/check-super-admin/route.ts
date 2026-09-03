import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isUserSuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/check-super-admin
 * Returns { isSuperAdmin: boolean }
 * Supports Cookie session and Authorization: Bearer <token>.
 */
export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    return NextResponse.json({ isSuperAdmin: false });
  }

  const serviceSb = serviceKey ? createSupabaseClient(supabaseUrl, serviceKey) : null;

  try {
    const supabase = await createServerClient();
    let {
      data: { user },
    } = await supabase.auth.getUser();

    // Check Authorization header fallback
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
      return NextResponse.json({ isSuperAdmin: false });
    }

    const superAdmin = await isUserSuperAdmin(user, serviceSb);
    return NextResponse.json({ isSuperAdmin: superAdmin });
  } catch (error) {
    console.error("[check-super-admin] error:", error);
    return NextResponse.json({ isSuperAdmin: false });
  }
}
