import { supabase } from "@/integrations/supabase/client";

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getAuthedUser() {
  const db = supabase as any;
  const {
    data: { session },
  } = await db.auth.getSession();
  return { db, user: session?.user };
}

/**
 * Calls the server-side /api/setup/provision-org endpoint which uses the
 * service role key to bypass RLS and create an org for the user.
 */
async function provisionOrgViaApi(): Promise<string | null> {
  try {
    const res = await fetch("/api/setup/provision-org", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("[org-scope] provision-org API error:", body?.error ?? res.status);
      return null;
    }
    const body = await res.json();
    return (body?.organizationId as string) ?? null;
  } catch (err) {
    console.error("[org-scope] provision-org fetch failed:", err);
    return null;
  }
}

let cachedOrgId: string | null = null;
let cachedTier: OrganizationTier | null = null;

export function clearOrgScopeCache() {
  cachedOrgId = null;
  cachedTier = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("sonolynx_cached_org_id");
      sessionStorage.removeItem("sonolynx_cached_org_tier");
    } catch {}
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the current user's organisation ID.
 * If the profile has no org yet, one is automatically created via the
 * server-side provision-org endpoint (which uses service role to bypass RLS).
 * Never returns null for authenticated users under normal conditions.
 */
export async function getCurrentUserOrganizationId(): Promise<string | null> {
  if (cachedOrgId) return cachedOrgId;
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("sonolynx_cached_org_id");
      if (stored) {
        cachedOrgId = stored;
        return stored;
      }
    } catch {}
  }

  const { db, user } = await getAuthedUser();
  if (!user?.id) return null;

  const { data, error } = await db
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[org-scope] Error fetching organization ID:", error);
  }

  if (data?.organization_id) {
    const orgId = data.organization_id as string;
    cachedOrgId = orgId;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("sonolynx_cached_org_id", orgId);
      } catch {}
    }
    return orgId;
  }

  // Do not fall back to a shared/default organisation. That would make a
  // missing membership look valid and could expose another clinic's data.
  // Provisioning is restricted to administrator accounts by the server route.
  console.info("[org-scope] No organization linked — requesting administrator provisioning");
  const provisioned = await provisionOrgViaApi();
  if (provisioned) {
    cachedOrgId = provisioned;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("sonolynx_cached_org_id", provisioned);
      } catch {}
    }
  }
  return provisioned;
}

/** Alias kept for backward-compat with all existing call-sites. */
export const getEffectiveOrganizationId = getCurrentUserOrganizationId;

export async function getCurrentUserRole(): Promise<string | null> {
  const { db, user } = await getAuthedUser();
  if (!user?.id) return null;
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.role ?? null;
}

// ─── Organization Tiers ────────────────────────────────────────────────────────
export type OrganizationTier = "individual" | "professional" | "enterprise";

export interface TierCapabilities {
  maxStaff: number;
  maxCustomTemplates: number;
  allowedTemplateIds: string[] | "all";
  canCreateCustomTemplates: boolean;
  canUseConditionalLogic: boolean;
}

export const TIER_CONFIG: Record<OrganizationTier, TierCapabilities> = {
  individual: {
    maxStaff: 3,
    maxCustomTemplates: 0,
    allowedTemplateIds: ["tpl-standard", "tpl-minimalist"],
    canCreateCustomTemplates: false,
    canUseConditionalLogic: false,
  },
  professional: {
    maxStaff: 15,
    maxCustomTemplates: 5,
    allowedTemplateIds: [
      "tpl-standard",
      "tpl-minimalist",
      "tpl-modernist",
      "tpl-paediatric",
      "tpl-vascular-protocol",
    ],
    canCreateCustomTemplates: true,
    canUseConditionalLogic: true,
  },
  enterprise: {
    maxStaff: Infinity,
    maxCustomTemplates: Infinity,
    allowedTemplateIds: "all",
    canCreateCustomTemplates: true,
    canUseConditionalLogic: true,
  },
};

export async function getCurrentUserOrganizationTier(): Promise<OrganizationTier> {
  if (cachedTier) return cachedTier;
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("sonolynx_cached_org_tier");
      if (stored) {
        cachedTier = stored as OrganizationTier;
        return cachedTier;
      }
    } catch {}
  }

  try {
    const orgId = await getCurrentUserOrganizationId();
    if (!orgId) return "individual";

    const { db } = await getAuthedUser();
    const { data: org, error } = await db
      .from("organizations")
      .select("tier")
      .eq("id", orgId)
      .maybeSingle();

    if (error) {
      console.warn(
        "[org-scope] Could not read tier, defaulting to individual:",
        error.message,
      );
      return "individual";
    }

    const tier = (org?.tier as OrganizationTier) ?? "individual";
    cachedTier = tier;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("sonolynx_cached_org_tier", tier);
      } catch {}
    }
    return tier;
  } catch (err) {
    console.warn("[org-scope] Unexpected error reading tier, defaulting to individual:", err);
    return "individual";
  }
}
