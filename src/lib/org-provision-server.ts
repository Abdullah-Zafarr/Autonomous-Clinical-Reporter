/**
 * Server-side organization provisioning helper.
 * Uses the service-role Supabase client to bypass RLS on the organizations table.
 * Call this from any server-side route when an admin user has no organization_id.
 */


import { getServiceClient } from "@/lib/supabase-service";

export async function ensureUserOrganization(
  userId: string,
  userEmail: string,
  extraProfileFields?: Record<string, string | null>,
): Promise<string | null> {
  const service = getServiceClient() as any;
  if (!service) {
    console.error("[provision] Missing service role key — cannot provision org");
    return null;
  }

  // Double-check: maybe it was just set by a concurrent request
  const { data: profile } = await service
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.organization_id) return profile.organization_id as string;

  // Create the org
  const displayName = userEmail.split("@")[0];
  const orgName = `${displayName}'s Organization`;
  const orgCode = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28) + "-" + userId.slice(0, 8);

  const { data: org, error: orgError } = await service
    .from("organizations")
    .insert({ name: orgName, code: orgCode })
    .select("id")
    .single();

  if (orgError || !org?.id) {
    console.error("[provision] Failed to create org:", orgError?.message);
    return null;
  }

  const organizationId = org.id as string;

  // Link profile
  const { error: linkError } = await service.from("profiles").upsert(
    {
      id: userId,
      email: userEmail,
      organization_id: organizationId,
      ...(extraProfileFields ?? {}),
    },
    { onConflict: "id" },
  );
  if (linkError) return null;

  console.info("[provision] Created org", organizationId, "for user", userId);
  return organizationId;
}
