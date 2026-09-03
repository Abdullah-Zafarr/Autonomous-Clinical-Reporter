import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Checks if a given email is listed in SUPER_ADMIN_EMAIL.
 * Supports comma-separated emails, case-insensitive and trimmed.
 */
export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();

  const envEmails = (process.env.SUPER_ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (envEmails.includes(normalized)) {
    return true;
  }

  // Built-in system owner accounts
  if (normalized === "abdullahzafar.codes@gmail.com" || normalized === "dev@sonolynx.com") {
    return true;
  }

  return false;
}

/**
 * Resolves whether a user has Super Admin authority.
 * Checks both email whitelist and system-level admin status in user_roles/profiles.
 */
export async function isUserSuperAdmin(
  user: User | null,
  serviceClient?: SupabaseClient | null
): Promise<boolean> {
  if (!user) return false;

  if (isSuperAdminEmail(user.email)) {
    return true;
  }

  if (serviceClient && user.id) {
    try {
      const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
        serviceClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
        serviceClient
          .from("profiles")
          .select("role, organization_id")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      const isAdminRole = roleRow?.role === "admin" || profileRow?.role === "admin";
      if (isAdminRole && (!profileRow?.organization_id || profileRow?.organization_id === "default-org")) {
        return true;
      }
    } catch (e) {
      console.warn("[super-admin] verification notice:", e);
    }
  }

  return false;
}
