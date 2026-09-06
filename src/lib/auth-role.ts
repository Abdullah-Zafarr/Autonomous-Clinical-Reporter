export type ClinicalRole = "admin" | "doctor" | "radiologist" | "sonographer";
export function resolveRole(profileRole: string | null | undefined, rows: Array<{ role: string }>): ClinicalRole | null {
  const valid: ClinicalRole[] = ["admin", "radiologist", "doctor", "sonographer"];
  // The profile is authoritative; stale role rows must not override a demotion.
  if (valid.includes(profileRole as ClinicalRole)) return profileRole as ClinicalRole;
  return valid.find((role) => rows.some((row) => row.role === role)) ?? null;
}
