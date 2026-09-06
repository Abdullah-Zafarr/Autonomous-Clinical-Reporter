import type { ExamType, Patient } from "@/lib/sonoflow-types";
import type { ReportSections } from "@/lib/report-engine";
import { reportToText } from "@/lib/report-engine";
import type {
  ReportBrandingSettings,
  ReportTemplate,
  ReportTemplateSection,
  ConditionalRule,
} from "@/lib/report-template-types";
import { DEFAULT_BRANDING_SETTINGS } from "@/lib/branding-service";

// ─── Context ──────────────────────────────────────────────────────────────────

export interface ReportTemplateContext {
  patient: Patient;
  examType: ExamType;
  accession: string;
  report: ReportSections;
  studyDate?: string | null;
  referringPhysician?: string | null;
  signedBy?: string | null;
  signedAt?: string | null;
  worksheetSummary?: string | null;
  patientAge?: string | null;
  patientGender?: string | null;
  additionalNotes?: string | null;
  // Clinical measurements for conditional logic evaluation
  clinicalData?: Record<string, number | string>;
}

export interface RenderedTemplateDocument {
  templateId: string;
  templateName: string;
  layoutStyle: ReportTemplate["layoutStyle"];
  sections: Array<{ title: string; content: string }>;
  plainText: string;
  usedFallback: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safe(value: string | null | undefined, fallback = ""): string {
  return (value ?? "").trim() || fallback;
}

function examLabel(exam: ExamType): string {
  const labels: Partial<Record<ExamType, string>> = {
    Thyroid:  "THYROID ULTRASOUND",
    OB:       "OBSTETRIC ULTRASOUND",
    Vascular: "VASCULAR DOPPLER ULTRASOUND",
    Abdomen:  "ABDOMINAL ULTRASOUND",
  };
  return labels[exam] ?? "ULTRASOUND EXAMINATION";
}

// ─── Token Map Builder ────────────────────────────────────────────────────────

export function buildTemplateContext(
  context: ReportTemplateContext,
  brandingInput?: ReportBrandingSettings | null,
): Record<string, string> {
  const branding = brandingInput ?? DEFAULT_BRANDING_SETTINGS;
  const findings  = context.report.findings.map((line) => `- ${line}`).join("\n");
  const impression = context.report.impression.map((line, i) => `${i + 1}. ${line}`).join("\n");

  return {
    "{{hospitalName}}":       safe(branding.hospitalName,    "Hospital / Lab"),
    "{{hospitalAddress}}":    safe(branding.hospitalAddress),
    "{{hospitalPhone}}":      safe(branding.hospitalPhone),
    "{{hospitalEmail}}":      safe(branding.hospitalEmail),
    "{{hospitalWebsite}}":    safe(branding.hospitalWebsite),
    "{{hospitalLogo}}":       safe(branding.logoUrl),
    "{{patientName}}":        `${context.patient.lastName}, ${context.patient.firstName}`,
    "{{patientAge}}":         safe(context.patientAge,       "-"),
    "{{patientGender}}":      safe(context.patientGender,    "-"),
    "{{mrn}}":                safe(context.patient.mrn,      "-"),
    "{{accession}}":          safe(context.accession,        "-"),
    "{{examType}}":           examLabel(context.examType),
    "{{studyDate}}":          safe(context.studyDate,        new Date().toLocaleDateString()),
    "{{referringPhysician}}": safe(context.referringPhysician, "-"),
    "{{findings}}":           safe(findings,                 "No findings available."),
    "{{impression}}":         safe(impression,               "No impression available."),
    "{{recommendations}}":    (context.report.recommendations ?? []).join("\n"),
    "{{additionalNotes}}":    safe(context.additionalNotes),
    "{{signedBy}}":           safe(context.signedBy,         "-"),
    "{{signedAt}}":           safe(context.signedAt,         "-"),
    "{{worksheetSummary}}":   safe(context.worksheetSummary, "-"),
    "{{sonuLabsBranding}}":   "Generated with Sonolynx",
  };
}

// ─── Placeholder Replacer ─────────────────────────────────────────────────────

export function replaceTemplatePlaceholders(
  content: string,
  tokens: Record<string, string>,
): string {
  return content.replace(/\{\{[a-zA-Z_]+\}\}/g, (match) => {
    return Object.prototype.hasOwnProperty.call(tokens, match) ? tokens[match] : match;
  });
}

// ─── Conditional Logic Evaluator ──────────────────────────────────────────────

function evaluateRule(
  rule: ConditionalRule,
  clinicalData: Record<string, number | string> = {},
): boolean {
  const rawValue = clinicalData[rule.field];
  if (rawValue === undefined || rawValue === null) return false;

  const fieldNum = parseFloat(String(rawValue));
  const ruleNum  = parseFloat(rule.value);

  // Numeric comparison
  if (!isNaN(fieldNum) && !isNaN(ruleNum)) {
    switch (rule.operator) {
      case ">":  return fieldNum >  ruleNum;
      case "<":  return fieldNum <  ruleNum;
      case ">=": return fieldNum >= ruleNum;
      case "<=": return fieldNum <= ruleNum;
      case "==": return fieldNum === ruleNum;
      case "!=": return fieldNum !== ruleNum;
    }
  }

  // String comparison fallback
  const fieldStr = String(rawValue).toLowerCase();
  const ruleStr  = rule.value.toLowerCase();
  switch (rule.operator) {
    case "==": return fieldStr === ruleStr;
    case "!=": return fieldStr !== ruleStr;
    default:   return false;
  }
}

/**
 * Parse {% if field operator value %}...content...{% endif %} blocks.
 * Evaluates each block against clinicalData and either includes or removes the content.
 */
export function evaluateConditionalBlocks(
  content: string,
  clinicalData: Record<string, number | string> = {},
): string {
  // Pattern: {% if field operator value %}content{% endif %}
  return content.replace(
    /\{%\s*if\s+(\w+)\s*(>=|<=|==|!=|>|<)\s*([^\s%]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g,
    (_match, field, operator, value, thenContent) => {
      const rule: ConditionalRule = {
        id: "inline",
        field,
        operator: operator as ConditionalRule["operator"],
        value,
        thenContent,
      };
      return evaluateRule(rule, clinicalData) ? thenContent.trim() : "";
    },
  );
}

// ─── Section Rules Evaluator ──────────────────────────────────────────────────

function applyConditionalRules(
  content: string,
  rules: ConditionalRule[] = [],
  clinicalData: Record<string, number | string> = {},
): string {
  let result = content;

  for (const rule of rules) {
    if (evaluateRule(rule, clinicalData)) {
      result = result + (result ? "\n\n" : "") + rule.thenContent;
    }
  }

  return result;
}

// ─── Section Renderer ─────────────────────────────────────────────────────────

export function renderTemplateSections(
  template: ReportTemplate,
  tokens: Record<string, string>,
  clinicalData: Record<string, number | string> = {},
): Array<{ title: string; content: string }> {
  return [...template.sections]
    .filter((section) => section.enabled)
    .sort((a, b) => a.order - b.order)
    .map((section: ReportTemplateSection) => {
      // 1. Evaluate inline {% if %}...{% endif %} blocks
      let content = evaluateConditionalBlocks(section.content, clinicalData);
      // 2. Apply structured conditional rules
      content = applyConditionalRules(content, section.conditionalRules, clinicalData);
      // 3. Replace {{placeholders}}
      content = replaceTemplatePlaceholders(content, tokens).trim();
      return { title: section.title, content };
    })
    .filter((section) => section.content.length > 0);
}

// ─── Full Render ──────────────────────────────────────────────────────────────

export function renderReportTemplate(
  template: ReportTemplate | null | undefined,
  context: ReportTemplateContext,
  branding?: ReportBrandingSettings | null,
): RenderedTemplateDocument {
  const notes = safe(context.additionalNotes);
  const fallback = reportToText(context.report) + (notes ? `\n\nADDITIONAL NOTES:\n${notes}` : "");

  if (!template || !template.isActive) {
    return {
      templateId:   "fallback-default",
      templateName: "Default Report",
      layoutStyle:  "standard",
      sections:     [{ title: "Report", content: fallback }],
      plainText:    fallback,
      usedFallback: true,
    };
  }

  try {
    const tokens       = buildTemplateContext(context, branding);
    const clinicalData = context.clinicalData ?? {};
    const sections     = renderTemplateSections(template, tokens, clinicalData);

    if (sections.length === 0) {
      return {
        templateId:   template.id,
        templateName: template.name,
        layoutStyle:  template.layoutStyle,
        sections:     [{ title: "Report", content: fallback }],
        plainText:    fallback,
        usedFallback: true,
      };
    }

    const content = sections.map((section) => section.content).join("\n");
    const recommendations = (context.report.recommendations ?? []).filter((line) => !content.includes(line));
    if (recommendations.length) sections.push({ title: "Recommendations", content: recommendations.join("\n") });
    if (notes && !content.includes(notes)) sections.push({ title: "Additional notes", content: notes });
    const plainText = sections.map((s) => `${s.title}\n${s.content}`).join("\n\n");
    return {
      templateId:   template.id,
      templateName: template.name,
      layoutStyle:  template.layoutStyle,
      sections,
      plainText,
      usedFallback: false,
    };
  } catch {
    return {
      templateId:   template.id,
      templateName: template.name,
      layoutStyle:  template.layoutStyle,
      sections:     [{ title: "Report", content: fallback }],
      plainText:    fallback,
      usedFallback: true,
    };
  }
}
