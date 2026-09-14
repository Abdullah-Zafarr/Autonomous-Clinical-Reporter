import { supabase } from "@/integrations/supabase/client";
import type { ReportBrandingSettings } from "@/lib/report-template-types";
import { getCurrentUserOrganizationId } from "@/lib/org-scope";

export const DEFAULT_BRANDING_SETTINGS: ReportBrandingSettings = {
  hospitalName: "Radix Partner Facility",
  hospitalAddress: "",
  hospitalPhone: "",
  hospitalEmail: "",
  hospitalWebsite: "",
  logoUrl: "",
  showSonolynxBranding: true,
  footerText: "",
};

export async function getBrandingSettings(): Promise<ReportBrandingSettings> {
  try {
    const organizationId = await getCurrentUserOrganizationId();
    if (!organizationId) return DEFAULT_BRANDING_SETTINGS;
    const db = supabase as any;
    const { data, error } = await db
      .from("report_branding_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return DEFAULT_BRANDING_SETTINGS;
    return {
      hospitalName: data.hospital_name ?? DEFAULT_BRANDING_SETTINGS.hospitalName,
      hospitalAddress: data.hospital_address ?? "",
      hospitalPhone: data.hospital_phone ?? "",
      hospitalEmail: data.hospital_email ?? "",
      hospitalWebsite: data.hospital_website ?? "",
      logoUrl: data.logo_url ?? "",
      showSonolynxBranding:
        typeof data.show_sonolynx_branding === "boolean"
          ? data.show_sonolynx_branding
          : DEFAULT_BRANDING_SETTINGS.showSonolynxBranding,
      footerText: data.footer_text ?? "",
    };
  } catch {
    return DEFAULT_BRANDING_SETTINGS;
  }
}

export async function updateBrandingSettings(input: ReportBrandingSettings) {
  const response = await fetch("/api/admin/branding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "Failed to update branding settings.");
  }
  return response.json();
}
