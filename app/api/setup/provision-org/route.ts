import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { ensureUserOrganization } from "@/lib/org-provision-server";

/**
 * POST /api/setup/provision-org
 * Creates an organisation for the currently authenticated user if they don't
 * have one yet, and links it to their profile row.
 * Uses the service-role key to bypass RLS on the organisations table.
 * Returns { organizationId: string } on success.
 */
export async function POST() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check profile first using the regular client (respects RLS for reads)
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("organization_id, email, first_name, last_name, role")
      .eq("id", user.id)
      .maybeSingle();

    // Already has an org — just return it
    if (profile?.organization_id) {
      return NextResponse.json({ organizationId: profile.organization_id });
    }

    // No org — provision one using service role (bypasses RLS)
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Clinic membership must be assigned by an administrator." }, { status: 403 });
    }
    const email = profile?.email ?? user.email ?? "";
    const organizationId = await ensureUserOrganization(user.id, email, {
      first_name: profile?.first_name ?? "",
      last_name: profile?.last_name ?? "",
      role: "admin",
    });

    if (!organizationId) {
      return NextResponse.json(
        { error: "Failed to create organization. Please contact support." },
        { status: 500 },
      );
    }

    return NextResponse.json({ organizationId });
  } catch (error) {
    console.error("[provision-org] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}
