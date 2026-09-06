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

  return false;
}

/**
 * Resolves whether a user has Super Admin authority.
 * Requires a verified email on the explicit server-side allowlist.
 */
export async function isUserSuperAdmin(
  user: User | null,
  _serviceClient?: SupabaseClient | null
): Promise<boolean> {
  if (!user) return false;

  if (user.email_confirmed_at && isSuperAdminEmail(user.email)) {
    return true;
  }

  return false;
}
