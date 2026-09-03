import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ensureUserOrganization } from "@/lib/org-provision-server";
import { isUserSuperAdmin } from "@/lib/super-admin";
import type { Database } from "@/integrations/supabase/types";

type CreateUserPayload = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: "doctor" | "sonographer" | "admin";
  organizationId?: string;
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

    const localDevBypass =
      process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

    const service = getServiceClient();
    const isSuperAdmin = localDevBypass || (await isUserSuperAdmin(user, service));

    if (!localDevBypass && !isSuperAdmin) {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

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
    
    let adminOrganizationId: string | null = null;

    if (!localDevBypass && user) {
      const { data: adminProfile } = await (supabase as any)
        .from("profiles")
        .select("organization_id, email")
        .eq("id", user.id)
        .maybeSingle();
      adminOrganizationId = adminProfile?.organization_id ?? null;

      // Auto-provision using service role to bypass RLS on organizations table
      if (!adminOrganizationId && !isSuperAdmin) {
        const email = adminProfile?.email ?? user.email ?? "";
        adminOrganizationId = await ensureUserOrganization(user.id, email);
      }
    }

    if (!isSuperAdmin && !adminOrganizationId) {
      return NextResponse.json({ error: "Unable to resolve organization for this admin. Please try again." }, { status: 400 });
    }

    const payload = (await request.json()) as CreateUserPayload;
    const email = payload.email?.trim().toLowerCase() ?? "";
    const password = payload.password?.trim() ?? "";
    const firstName = payload.firstName?.trim() ?? "";
    const lastName = payload.lastName?.trim() ?? "";
    const role = payload.role;
    const targetOrganizationId = payload.organizationId;

    if (!email || !password || !firstName || !lastName || (role !== "doctor" && role !== "sonographer" && role !== "admin")) {
      return NextResponse.json(
        { error: "Invalid payload. Required: email, password, firstName, lastName, role(doctor|sonographer|admin)." },
        { status: 400 },
      );
    }

    if (!service) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    let resolvedOrganizationId = (isSuperAdmin && targetOrganizationId) ? targetOrganizationId : adminOrganizationId;
    if (localDevBypass && !resolvedOrganizationId) {
      const { data: defaultOrganization } = await (service as any)
        .from("organizations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      resolvedOrganizationId = defaultOrganization?.id ?? null;
    }

    const createResult = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (createResult.error || !createResult.data.user) {
      return NextResponse.json({ error: createResult.error?.message ?? "Failed to create user" }, { status: 400 });
    }

    const createdUser = createResult.data.user;
    const profileUpsert = await (service as any).from("profiles").upsert(
      {
        id: createdUser.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        organization_id: resolvedOrganizationId,
      },
      { onConflict: "id" },
    );
    if (profileUpsert.error) {
      return NextResponse.json({ error: profileUpsert.error.message }, { status: 400 });
    }

    const roleUpsert = await (service as any)
      .from("user_roles")
      .upsert({ user_id: createdUser.id, role }, { onConflict: "user_id,role" });

    let roleWarning: string | null = null;
    if (roleUpsert.error) {
      const fallbackRole = "doctor";
      const fallback = await (service as any)
        .from("user_roles")
        .upsert({ user_id: createdUser.id, role: fallbackRole }, { onConflict: "user_id,role" });
      if (fallback.error) {
        return NextResponse.json(
          { error: `Created auth user, but failed assigning role. ${fallback.error.message}` },
          { status: 400 },
        );
      }
      roleWarning = `Role enum in user_roles does not include "${role}" yet. Fallback role "${fallbackRole}" assigned, profile.role kept as "${role}".`;
    }

    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      userId: createdUser.id,
      email,
      role,
      roleWarning,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}
