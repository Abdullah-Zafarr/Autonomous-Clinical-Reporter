import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ensureUserOrganization } from "@/lib/org-provision-server";
import { isUserSuperAdmin } from "@/lib/super-admin";
import type { Database } from "@/integrations/supabase/types";

type DeletePayload = {
  userId?: string;
};

const CANONICAL_SUPABASE_URL = "https://ecjbflirovcqqoqnzlsc.supabase.co";
const CANONICAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjamJmbGlyb3ZjcXFvcW56bHNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzkxNzg2NiwiZXhwIjoyMTAzNDkzODY2fQ.Ja4RdtRuUS1rZbFejUwhjbZvOM06lZzJZAbi8wQ3AYk";

function getServiceClient() {
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isLegacyOrEmpty =
    !rawUrl || rawUrl.includes("mbskxsigmaduwywvluin") || !rawKey || rawKey.includes("mbskxsigmaduwywvluin");
  const url = isLegacyOrEmpty ? CANONICAL_SUPABASE_URL : rawUrl;
  const serviceKey = isLegacyOrEmpty ? CANONICAL_SERVICE_KEY : rawKey;
  if (!url || !serviceKey) {
    return null;
  }
  return createServiceClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: Request) {
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

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const service = getServiceClient();
    const isSuperAdmin = await isUserSuperAdmin(user, service);

    if (!isSuperAdmin) {
      const { data: adminRoleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");
      
      let isAdmin = adminRoleRows && adminRoleRows.length > 0;
      if (!isAdmin) {
        const { data: prof } = await (supabase as any)
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (prof?.role === "admin") {
          isAdmin = true;
        }
      }

      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
      }
    }

    const { data: adminProfile } = await (supabase as any)
      .from("profiles")
      .select("organization_id, email")
      .eq("id", user.id)
      .maybeSingle();
    let adminOrganizationId: string | null = adminProfile?.organization_id ?? null;

    // Auto-provision using service role to bypass RLS on organizations table
    if (!adminOrganizationId && !isSuperAdmin) {
      const email = adminProfile?.email ?? user.email ?? "";
      adminOrganizationId = await ensureUserOrganization(user.id, email);
    }

    // Only enforce organization boundary if NOT super admin
    if (!isSuperAdmin && !adminOrganizationId) {
      return NextResponse.json({ error: "Unable to resolve organization for this admin. Please try again." }, { status: 400 });
    }

    const payload = (await request.json()) as DeletePayload;
    const userId = payload.userId?.trim();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    if (userId === user.id) return NextResponse.json({ error: "Admin cannot delete own account." }, { status: 400 });

    const { data: targetProfile } = await (supabase as any)
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    
    // Only enforce boundary check if NOT super admin
    if (!isSuperAdmin) {
      if (!targetProfile || targetProfile.organization_id !== adminOrganizationId) {
        return NextResponse.json({ error: "Cannot delete user outside your organization boundary." }, { status: 403 });
      }
    }

    if (!service) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    const removeUserRoles = await (service as any).from("user_roles").delete().eq("user_id", userId);
    if (removeUserRoles.error) return NextResponse.json({ error: removeUserRoles.error.message }, { status: 400 });

    const removeProfile = await (service as any).from("profiles").delete().eq("id", userId);
    if (removeProfile.error) return NextResponse.json({ error: removeProfile.error.message }, { status: 400 });

    const deleteAuth = await service.auth.admin.deleteUser(userId);
    if (deleteAuth.error) return NextResponse.json({ error: deleteAuth.error.message }, { status: 400 });

    revalidatePath("/admin");

    return NextResponse.json({ ok: true, deletedUserId: userId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}
