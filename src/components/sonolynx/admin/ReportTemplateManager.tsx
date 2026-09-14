"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Plus, Trash2, ChevronUp, ChevronDown, Zap, Eye, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { ExamType, Patient } from "@/lib/sonoflow-types";
import type { ReportSections } from "@/lib/report-engine";
import { getAllTemplates, createTemplate, updateTemplate, deactivateTemplate } from "@/lib/report-template-service";
import { DEFAULT_REPORT_TEMPLATES } from "@/lib/default-report-templates";
import {
  PLACEHOLDER_GROUPS,
  LAYOUT_THEME_META,
  CONDITIONAL_LOGIC_FIELDS,
  DEFAULT_THEME_OPTIONS,
  type ReportTemplate,
  type ReportTemplateExamType,
  type ReportTemplateSection,
  type ReportTemplateLayoutStyle,
  type ConditionalRule,
  type TemplateThemeOptions,
} from "@/lib/report-template-types";
import { renderReportTemplate, type ReportTemplateContext } from "@/lib/report-template-engine";
import { DEFAULT_BRANDING_SETTINGS } from "@/lib/branding-service";
import { A4TemplatePreview } from "@/components/sonoflow/A4TemplatePreview";
import { 
  getCurrentUserOrganizationTier, 
  TIER_CONFIG, 
  type OrganizationTier, 
  type TierCapabilities 
} from "@/lib/org-scope";
import { Lock } from "lucide-react";

// ─── Sample Data ──────────────────────────────────────────────────────────────
const SAMPLE_CONTEXT: ReportTemplateContext = {
  patient: { id: "s", firstName: "Jane", lastName: "Doe", mrn: "MRN-100001", dob: "1988-01-01", exam: "Ultrasound" } as Patient,
  examType: "Abdomen" as ExamType,
  accession: "ACC-2026-0001",
  report: {
    findings: ["Liver is normal in size and echotexture.", "No hydronephrosis identified.", "Spleen within normal limits."],
    impression: ["No acute abnormality detected.", "Recommend clinical correlation."],
  } as ReportSections,
  studyDate: new Date().toLocaleDateString(),
  referringPhysician: "Dr. Sarah Mitchell",
  signedBy: "Dr. James Reviewer",
  signedAt: new Date().toLocaleString(),
  worksheetSummary: "Liver 14 cm, CBD 4 mm, bilateral kidneys normal size and echotexture.",
  patientAge: "38",
  patientGender: "Female",
  clinicalData: { thyroid_nodule_size: 12, liver_size_cm: 14, cbd_diameter: 4 },
};

function newSection(order: number): ReportTemplateSection {
  return { id: `sec-${Date.now()}-${order}`, title: `New Section`, order, enabled: true, content: "", placeholders: [], conditionalRules: [] };
}

function newRule(): ConditionalRule {
  return { id: `rule-${Date.now()}`, field: "thyroid_nodule_size", operator: ">", value: "10", thenContent: "Recommendation: Consider FNA based on ACR TI-RADS guidelines." };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ReportTemplateManager() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<"sections" | "rules" | "theme">("sections");
  const [orgTier, setOrgTier] = useState<OrganizationTier>("individual");
  const [tierLimits, setTierLimits] = useState<TierCapabilities>(TIER_CONFIG.individual);

  // Editable state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [examType, setExamType] = useState<ReportTemplateExamType>("general");
  const [layoutStyle, setLayoutStyle] = useState<ReportTemplateLayoutStyle>("standard");
  const [sections, setSections] = useState<ReportTemplateSection[]>([]);
  const [supportsLogo, setSupportsLogo] = useState(true);
  const [includesBranding, setIncludesBranding] = useState(false);
  const [themeOptions, setThemeOptions] = useState<TemplateThemeOptions>({ ...DEFAULT_THEME_OPTIONS });
  const patchTheme = (patch: Partial<TemplateThemeOptions>) => setThemeOptions(prev => ({ ...prev, ...patch }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tier = await getCurrentUserOrganizationTier();
      setOrgTier(tier);
      const limits = TIER_CONFIG[tier];
      setTierLimits(limits);

      const items = await getAllTemplates();
      const all = items.length > 0 ? items : DEFAULT_REPORT_TEMPLATES;
      setTemplates(all);
      
      // If selected is locked, switch to first allowed
      if (!selectedId && all.length > 0) {
        const firstAllowed = all.find(t => limits.allowedTemplateIds === "all" || limits.allowedTemplateIds.includes(t.id));
        if (firstAllowed) setSelectedId(firstAllowed.id);
        else setSelectedId(all[0].id);
      }
    } catch {
      setTemplates(DEFAULT_REPORT_TEMPLATES);
      if (!selectedId) setSelectedId(DEFAULT_REPORT_TEMPLATES[0].id);
    } finally { setLoading(false); }
  }, [selectedId]);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => templates.find(t => t.id === selectedId) ?? null, [templates, selectedId]);
  const isEditable = selected?.templateType === "custom";

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setDescription(selected.description);
    setExamType(selected.examType);
    setLayoutStyle(selected.layoutStyle);
    setSupportsLogo(selected.supportsLogo);
    setIncludesBranding(selected.includesSonolynxBranding);
    setThemeOptions(selected.themeOptions ?? { ...DEFAULT_THEME_OPTIONS });
    setSections([...selected.sections].sort((a, b) => a.order - b.order).map(s => ({ ...s, conditionalRules: s.conditionalRules ?? [] })));
  }, [selected]);

  const draftTemplate = useMemo((): ReportTemplate | null => {
    if (!selected) return null;
    return { ...selected, name, description, examType, layoutStyle, supportsLogo, includesSonolynxBranding: includesBranding, themeOptions, sections };
  }, [selected, name, description, examType, layoutStyle, supportsLogo, includesBranding, themeOptions, sections]);

  const rendered = useMemo(() => {
    if (!draftTemplate) return null;
    return renderReportTemplate(draftTemplate, SAMPLE_CONTEXT, DEFAULT_BRANDING_SETTINGS);
  }, [draftTemplate]);

  const handleCreate = async () => {
    if (!tierLimits.canCreateCustomTemplates) {
      toast.error("Architect Locked", { description: "Upgrade to Clinic to create custom templates." });
      return;
    }
    const created = await createTemplate({
      name: "My Custom Template", description: "Custom template", examType: "general",
      templateType: "custom", tierAvailability: "enterprise", supportsLogo: true,
      includesSonolynxBranding: false, layoutStyle: "standard",
      themeOptions: { ...DEFAULT_THEME_OPTIONS },
      sections: [newSection(1)], isActive: true, createdBy: null,
    });
    await load();
    setSelectedId(created.id);
    toast.success("Custom template created");
  };

  const handleSave = async () => {
    if (!selected || !isEditable) return;
    await updateTemplate(selected.id, {
      name, description, examType, layoutStyle, supportsLogo, includesSonolynxBranding: includesBranding,
      themeOptions,
      sections: sections.map((s, i) => ({ ...s, order: i + 1 })),
    });
    await load();
    toast.success("Template saved");
  };

  const handleDeactivate = async () => {
    if (!selected || !isEditable) return;
    await deactivateTemplate(selected.id);
    await load();
    toast.info("Template deactivated");
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    setSections(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const updateSection = (id: string, patch: Partial<ReportTemplateSection>) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));

  const insertToken = (sectionId: string, token: string) =>
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, content: s.content + (s.content.endsWith(" ") || !s.content ? "" : " ") + token } : s));

  const addRule = (sectionId: string) =>
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, conditionalRules: [...(s.conditionalRules ?? []), newRule()] } : s));

  const updateRule = (sectionId: string, ruleId: string, patch: Partial<ConditionalRule>) =>
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, conditionalRules: (s.conditionalRules ?? []).map(r => r.id === ruleId ? { ...r, ...patch } : r) } : s));

  const removeRule = (sectionId: string, ruleId: string) =>
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, conditionalRules: (s.conditionalRules ?? []).filter(r => r.id !== ruleId) } : s));

  return (
    <div className="flex h-full flex-col gap-4">
      {/* ── Top Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Template Architect</h3>
          <p className="text-xs text-muted-foreground">Admin-only · Premade templates are read-only</p>
        </div>
        <div className="flex gap-2">
          {isEditable && <Button size="sm" variant="outline" onClick={handleDeactivate}>Deactivate</Button>}
          {isEditable && <Button size="sm" onClick={handleSave}><Save className="mr-1.5 h-3.5 w-3.5" />Save Template</Button>}
          <Button size="sm" variant="secondary" onClick={() => setShowPreview(p => !p)}>
            <Eye className="mr-1.5 h-3.5 w-3.5" />{showPreview ? "Hide Preview" : "Live Preview"}
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={!tierLimits.canCreateCustomTemplates}>
            {!tierLimits.canCreateCustomTemplates && <Lock className="mr-1.5 h-3 w-3" />}
            <Plus className="mr-1.5 h-3.5 w-3.5" />New Template
          </Button>
        </div>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* ── Template List ── */}
        <div className="space-y-2">
          {loading && <div className="text-xs text-muted-foreground p-2">Loading templates…</div>}
          {templates.map(t => {
            const isLocked = tierLimits.allowedTemplateIds !== "all" && !tierLimits.allowedTemplateIds.includes(t.id);
            return (
              <button
                key={t.id} type="button"
                disabled={isLocked}
                onClick={() => setSelectedId(t.id)}
                className={`w-full rounded-xl border p-3 text-left transition-all ${isLocked ? "opacity-60 cursor-not-allowed bg-muted/20" : "hover:shadow-sm bg-card"} ${selectedId === t.id ? "border-primary bg-primary/5 shadow-sm" : "border-border"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{LAYOUT_THEME_META[t.layoutStyle]?.icon ?? "◻"}</span>
                  <span className="flex-1 truncate text-sm font-medium">{t.name}</span>
                  {isLocked ? (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Badge variant={t.templateType === "custom" ? "default" : "secondary"} className="text-[10px]">
                      {t.templateType === "custom" ? "Custom" : "Built-in"}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {isLocked ? "Upgrade plan to unlock this template." : t.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* ── Editor ── */}
        {!selected ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed text-muted-foreground text-sm">Select a template to begin</div>
        ) : (
          <div className="grid gap-4 overflow-auto" style={{ gridTemplateColumns: showPreview ? "1fr 1fr" : "1fr" }}>
            <div className="space-y-4">
              {/* ── Meta Fields ── */}
              <Card className="p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Template Name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} disabled={!isEditable} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Exam Type</Label>
                    <select value={examType} onChange={e => setExamType(e.target.value as ReportTemplateExamType)} disabled={!isEditable}
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50">
                      {["general","abdomen","thyroid","ob","vascular"].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} disabled={!isEditable} />
                </div>
              </Card>

              {/* ── Tab Navigation ── */}
              <div className="flex gap-1 rounded-lg border p-1 bg-muted/30">
                {(["sections","theme","rules"] as const).map(tab => {
                  const isTabLocked = tab === "rules" && !tierLimits.canUseConditionalLogic;
                  return (
                    <button key={tab} type="button" disabled={isTabLocked}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${activeTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"} ${isTabLocked ? "opacity-50 cursor-not-allowed" : ""}`}>
                      {isTabLocked && <Lock className="h-2.5 w-2.5" />}
                      {tab.charAt(0).toUpperCase()+tab.slice(1)}
                    </button>
                  );
                })}
              </div>

              {/* ── Sections Tab ── */}
              {activeTab === "sections" && (
                <div className="space-y-3">
                  {sections.map((sec, idx) => (
                    <SectionCard key={sec.id} section={sec} idx={idx} total={sections.length}
                      disabled={!isEditable}
                      onMove={dir => moveSection(idx, dir)}
                      onRemove={() => setSections(prev => prev.filter(s => s.id !== sec.id))}
                      onUpdate={patch => updateSection(sec.id, patch)}
                      onInsertToken={token => insertToken(sec.id, token)}
                    />
                  ))}
                  {isEditable && (
                    <Button variant="outline" size="sm" className="w-full border-dashed"
                      onClick={() => setSections(prev => [...prev, newSection(prev.length + 1)])}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />Add Section
                    </Button>
                  )}
                </div>
              )}

              {/* ── Theme Tab ── */}
              {activeTab === "theme" && (
                <div className="space-y-5">
                  {/* Layout Picker */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(Object.entries(LAYOUT_THEME_META) as [ReportTemplateLayoutStyle, typeof LAYOUT_THEME_META[ReportTemplateLayoutStyle]][]).map(([key, meta]) => (
                      <button key={key} type="button" disabled={!isEditable}
                        onClick={() => setLayoutStyle(key)}
                        className={`rounded-xl border p-4 text-left transition-all disabled:opacity-50 ${layoutStyle === key ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}>
                        <div className="text-2xl mb-2">{meta.icon}</div>
                        <div className="text-sm font-semibold">{meta.label}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{meta.description}</div>
                      </button>
                    ))}
                  </div>

                  {/* Color Controls */}
                  <Card className="p-4 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Colors</div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {([
                        { key: "accentColor", label: "Accent" },
                        { key: "headerBg",    label: "Header BG" },
                        { key: "headerText",  label: "Header Text" },
                        { key: "bodyText",    label: "Body Text" },
                      ] as { key: keyof TemplateThemeOptions; label: string }[]).map(({ key, label }) => (
                        <div key={key} className="space-y-1">
                          <label className="text-[11px] text-muted-foreground">{label}</label>
                          <div className="flex items-center gap-1.5">
                            <input type="color" disabled={!isEditable}
                              value={String(themeOptions[key])}
                              onChange={e => patchTheme({ [key]: e.target.value } as Partial<TemplateThemeOptions>)}
                              className="h-8 w-10 cursor-pointer rounded border disabled:opacity-40" />
                            <span className="text-[10px] font-mono text-muted-foreground">{String(themeOptions[key])}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Typography Controls */}
                  <Card className="p-4 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Typography & Spacing</div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Font Family</label>
                        <select value={themeOptions.fontFamily} disabled={!isEditable}
                          onChange={e => patchTheme({ fontFamily: e.target.value as TemplateThemeOptions["fontFamily"] })}
                          className="h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50">
                          <option value="sans">Sans-serif (Modern)</option>
                          <option value="serif">Serif (Traditional)</option>
                          <option value="mono">Monospace (Technical)</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Font Size</label>
                        <select value={themeOptions.fontSize} disabled={!isEditable}
                          onChange={e => patchTheme({ fontSize: e.target.value as TemplateThemeOptions["fontSize"] })}
                          className="h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50">
                          <option value="small">Small (Dense)</option>
                          <option value="medium">Medium (Standard)</option>
                          <option value="large">Large (Accessible)</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Page Margins</label>
                        <select value={themeOptions.pageMargin} disabled={!isEditable}
                          onChange={e => patchTheme({ pageMargin: e.target.value as TemplateThemeOptions["pageMargin"] })}
                          className="h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50">
                          <option value="compact">Compact</option>
                          <option value="normal">Normal</option>
                          <option value="spacious">Spacious</option>
                        </select>
                      </div>
                    </div>
                  </Card>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={supportsLogo} disabled={!isEditable} onChange={e => setSupportsLogo(e.target.checked)} />
                      Show Hospital Logo
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={includesBranding} disabled={!isEditable} onChange={e => setIncludesBranding(e.target.checked)} />
                      Radix Branding
                    </label>
                  </div>
                </div>
              )}

              {/* ── Rules Tab ── */}
              {activeTab === "rules" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Add conditional logic to sections. Content is appended when the condition is met during report generation.</p>
                  {sections.filter(s => s.enabled).map(sec => (
                    <Card key={sec.id} className="p-3 space-y-2">
                      <div className="text-xs font-semibold text-foreground">{sec.title}</div>
                      {(sec.conditionalRules ?? []).map(rule => (
                        <RuleRow key={rule.id} rule={rule} disabled={!isEditable}
                          onChange={patch => updateRule(sec.id, rule.id, patch)}
                          onRemove={() => removeRule(sec.id, rule.id)} />
                      ))}
                      {isEditable && (
                        <Button variant="ghost" size="sm" className="w-full text-xs border border-dashed"
                          onClick={() => addRule(sec.id)}>
                          <Zap className="mr-1.5 h-3 w-3" />Add Rule to "{sec.title}"
                        </Button>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* ── Live A4 Preview ── */}
            {showPreview && rendered && (
              <div className="sticky top-0 h-fit">
                <A4TemplatePreview rendered={rendered} layoutStyle={layoutStyle} themeOptions={themeOptions} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ section, idx, total, disabled, onMove, onRemove, onUpdate, onInsertToken }: {
  section: ReportTemplateSection; idx: number; total: number; disabled: boolean;
  onMove: (dir: -1 | 1) => void; onRemove: () => void;
  onUpdate: (patch: Partial<ReportTemplateSection>) => void;
  onInsertToken: (token: string) => void;
}) {
  const [showTokens, setShowTokens] = useState(false);

  return (
    <Card className="overflow-hidden border-border">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input value={section.title} disabled={disabled} onChange={e => onUpdate({ title: e.target.value })}
          className="h-7 border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0" />
        <div className="ml-auto flex items-center gap-1">
          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={section.enabled} disabled={disabled} onChange={e => onUpdate({ enabled: e.target.checked })} />
            On
          </label>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={disabled || idx === 0} onClick={() => onMove(-1)}><ChevronUp className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={disabled || idx === total - 1} onClick={() => onMove(1)}><ChevronDown className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" disabled={disabled} onClick={onRemove}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <Textarea value={section.content} disabled={disabled} rows={4}
          onChange={e => onUpdate({ content: e.target.value })}
          placeholder='Use {{tokens}} or {% if field > value %} conditional {% endif %} blocks'
          className="font-mono text-xs resize-none" />
        <div>
          <button type="button" onClick={() => setShowTokens(p => !p)} className="text-[11px] text-primary hover:underline">
            {showTokens ? "Hide token library" : "＋ Insert token"}
          </button>
          {showTokens && (
            <div className="mt-2 rounded-lg border bg-muted/20 backdrop-blur-sm p-3 space-y-2">
              {Object.entries(PLACEHOLDER_GROUPS).map(([group, tokens]) => (
                <div key={group}>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</div>
                  <div className="flex flex-wrap gap-1">
                    {tokens.map(token => (
                      <button key={token} type="button" disabled={disabled}
                        onClick={() => onInsertToken(token)}
                        className="rounded bg-background border px-1.5 py-0.5 text-[10px] font-mono hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Rule Row ─────────────────────────────────────────────────────────────────
function RuleRow({ rule, disabled, onChange, onRemove }: {
  rule: ConditionalRule; disabled: boolean;
  onChange: (patch: Partial<ConditionalRule>) => void; onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-900/10 p-2.5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">IF</span>
        <select value={rule.field} disabled={disabled} onChange={e => onChange({ field: e.target.value })}
          className="h-7 rounded border bg-background px-1.5 text-xs flex-1 min-w-[120px]">
          {CONDITIONAL_LOGIC_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <select value={rule.operator} disabled={disabled} onChange={e => onChange({ operator: e.target.value as ConditionalRule["operator"] })}
          className="h-7 rounded border bg-background px-1.5 text-xs w-14">
          {([">","<",">=","<=","==","!="] as const).map(op => <option key={op} value={op}>{op}</option>)}
        </select>
        <Input value={rule.value} disabled={disabled} onChange={e => onChange({ value: e.target.value })} className="h-7 w-20 text-xs" />
        <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto text-muted-foreground" disabled={disabled} onClick={onRemove}><X className="h-3 w-3" /></Button>
      </div>
      <div>
        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mr-2">THEN APPEND</span>
        <Textarea value={rule.thenContent} disabled={disabled} rows={2}
          onChange={e => onChange({ thenContent: e.target.value })}
          className="mt-1 text-xs resize-none" />
      </div>
    </div>
  );
}
