import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_REPORT_TEMPLATES } from "@/lib/default-report-templates";
import type { ReportTemplate, ReportTemplateExamType, ReportTemplateSection, TemplateThemeOptions } from "@/lib/report-template-types";
import { DEFAULT_THEME_OPTIONS } from "@/lib/report-template-types";
import { getCurrentUserOrganizationId } from "@/lib/org-scope";

const LOCAL_CUSTOM_TEMPLATES_KEY = "sonolynx_custom_templates_v2";

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeSections(raw: unknown): ReportTemplateSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      id: String(row.id ?? `section-${index + 1}`),
      title: String(row.title ?? `Section ${index + 1}`),
      order: Number(row.order ?? index + 1),
      enabled: row.enabled !== false,
      content: String(row.content ?? ""),
      placeholders: Array.isArray(row.placeholders) ? row.placeholders.map(String) : [],
      conditionalRules: Array.isArray(row.conditionalRules) ? row.conditionalRules : [],
    };
  });
}

function normalizeThemeOptions(raw: unknown): TemplateThemeOptions {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_THEME_OPTIONS };
  const r = raw as Record<string, unknown>;
  return {
    accentColor: String(r.accentColor ?? DEFAULT_THEME_OPTIONS.accentColor),
    headerBg:    String(r.headerBg    ?? DEFAULT_THEME_OPTIONS.headerBg),
    headerText:  String(r.headerText  ?? DEFAULT_THEME_OPTIONS.headerText),
    bodyText:    String(r.bodyText    ?? DEFAULT_THEME_OPTIONS.bodyText),
    fontFamily:  (r.fontFamily  as TemplateThemeOptions["fontFamily"])  ?? DEFAULT_THEME_OPTIONS.fontFamily,
    fontSize:    (r.fontSize    as TemplateThemeOptions["fontSize"])    ?? DEFAULT_THEME_OPTIONS.fontSize,
    pageMargin:  (r.pageMargin  as TemplateThemeOptions["pageMargin"])  ?? DEFAULT_THEME_OPTIONS.pageMargin,
  };
}

function normalizeTemplate(raw: Record<string, unknown>): ReportTemplate {
  return {
    id: String(raw.id ?? `tpl-${Math.random().toString(36).slice(2, 8)}`),
    name: String(raw.name ?? "Untitled template"),
    description: String(raw.description ?? ""),
    examType: (raw.examType ?? raw.exam_type ?? "general") as ReportTemplateExamType,
    templateType: (raw.templateType ?? raw.template_type ?? "custom") as ReportTemplate["templateType"],
    tierAvailability: (raw.tierAvailability ?? raw.tier_availability ?? "individual") as ReportTemplate["tierAvailability"],
    supportsLogo: raw.supportsLogo ?? raw.supports_logo ? true : false,
    includesSonolynxBranding:
      typeof raw.includesSonolynxBranding === "boolean" ? raw.includesSonolynxBranding
      : typeof raw.includes_sonolynx_branding === "boolean" ? Boolean(raw.includes_sonolynx_branding) : false,
    layoutStyle: (raw.layoutStyle ?? raw.layout_style ?? "standard") as ReportTemplate["layoutStyle"],
    themeOptions: normalizeThemeOptions(raw.themeOptions ?? raw.theme_options),
    sections: normalizeSections(raw.sections),
    isActive: raw.isActive !== false && raw.is_active !== false,
    createdBy: raw.createdBy ? String(raw.createdBy) : raw.created_by ? String(raw.created_by) : null,
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? new Date().toISOString()),
  };
}

function getLocalCustomTemplates(): ReportTemplate[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return parsed.map(normalizeTemplate);
  } catch {
    return [];
  }
}

function setLocalCustomTemplates(items: ReportTemplate[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(LOCAL_CUSTOM_TEMPLATES_KEY, JSON.stringify(items));
}

async function getDbTemplates(): Promise<ReportTemplate[]> {
  try {
    const organizationId = await getCurrentUserOrganizationId();
    if (!organizationId) return [];
    const db = supabase as any;
    const query = db
      .from("report_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(normalizeTemplate);
  } catch {
    return [];
  }
}

export async function getAllTemplates(): Promise<ReportTemplate[]> {
  const dbTemplates = await getDbTemplates();
  const localCustom = getLocalCustomTemplates();
  const merged = [...DEFAULT_REPORT_TEMPLATES, ...dbTemplates, ...localCustom];
  const seen = new Set<string>();
  return merged.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function getActiveTemplates(): Promise<ReportTemplate[]> {
  const all = await getAllTemplates();
  return all.filter((item) => item.isActive);
}

export async function getTemplatesByExamType(examType: ReportTemplateExamType): Promise<ReportTemplate[]> {
  const active = await getActiveTemplates();
  return active.filter((item) => item.examType === "general" || item.examType === examType);
}

export async function createTemplate(template: Omit<ReportTemplate, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const created: ReportTemplate = {
    ...template,
    id: `custom-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const organizationId = await getCurrentUserOrganizationId();
    if (!organizationId) throw new Error("Organization context not found");
    const db = supabase as any;
    const { error } = await db.from("report_templates").insert({
      id: created.id,                  // ← pass our generated ID to prevent duplicates
      name: created.name,
      description: created.description,
      exam_type: created.examType,
      template_type: created.templateType,
      tier_availability: created.tierAvailability,
      supports_logo: created.supportsLogo,
      includes_sonolynx_branding: created.includesSonolynxBranding,
      layout_style: created.layoutStyle,
      theme_options: created.themeOptions,
      sections: created.sections,
      is_active: created.isActive,
      created_by: created.createdBy,
      organization_id: organizationId,
    });
    if (!error) return created;
  } catch {
    // Fall back to local storage below.
  }

  const local = getLocalCustomTemplates();
  setLocalCustomTemplates([created, ...local]);
  return created;
}

export async function updateTemplate(templateId: string, updates: Partial<ReportTemplate>) {
  const now = new Date().toISOString();
  try {
    const organizationId = await getCurrentUserOrganizationId();
    if (!organizationId) throw new Error("Organization context not found");
    const db = supabase as any;
    const { error } = await db
      .from("report_templates")
      .update({
        name: updates.name,
        description: updates.description,
        exam_type: updates.examType,
        template_type: updates.templateType,
        tier_availability: updates.tierAvailability,
        supports_logo: updates.supportsLogo,
        includes_sonolynx_branding: updates.includesSonolynxBranding,
        layout_style: updates.layoutStyle,
        sections: updates.sections,
        is_active: updates.isActive,
        updated_at: now,
      })
      .eq("id", templateId)
      .eq("organization_id", organizationId);
    if (!error) return true;
  } catch {
    // fall through to local
  }

  const local = getLocalCustomTemplates();
  const next = local.map((item) =>
    item.id === templateId ? { ...item, ...updates, updatedAt: now } : item,
  );
  setLocalCustomTemplates(next);
  return true;
}

export async function deactivateTemplate(templateId: string) {
  return updateTemplate(templateId, { isActive: false });
}
