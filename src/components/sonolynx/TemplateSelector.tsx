import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { Layout, Loader2, Settings2, Plus } from "lucide-react";
import { TemplateEditor } from "./TemplateEditor";

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  content_structure: string;
  is_system: boolean;
}

const DEFAULT_PRESETS: ReportTemplate[] = [
  { id: "std", name: "Standard Clinical", description: "Standard comprehensive report format", content_structure: "", is_system: true },
  { id: "fast", name: "Emergency/FAST Focus", description: "Focused trauma/emergency assessment", content_structure: "", is_system: true },
  { id: "exec", name: "Executive Summary", description: "High-level summary for rounds & referrers", content_structure: "", is_system: true },
  { id: "point", name: "Point Form", description: "Bulleted outline for rapid review", content_structure: "", is_system: true },
  { id: "detail", name: "Research/Detailed", description: "Full anatomical survey with all parameters", content_structure: "", is_system: true },
];

interface TemplateSelectorProps {
  category: string;
  onSelect: (template: ReportTemplate) => void;
  selectedId?: string;
}

export function TemplateSelector({ category, onSelect, selectedId }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<ReportTemplate[]>(DEFAULT_PRESETS);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const { data }: { data: ReportTemplate[] } = await (supabase as any)
        .from("report_templates")
        .select("*")
        .eq("category", category)
        .order("is_system", { ascending: false })
        .order("name", { ascending: true });

      if (data && data.length > 0) {
        setTemplates(data);
        if (!selectedId) {
          const standard = data.find((t) => t.name === "Standard Clinical") || data[0];
          onSelect(standard);
        }
      } else {
        setTemplates(DEFAULT_PRESETS);
        if (!selectedId) {
          onSelect(DEFAULT_PRESETS[0]);
        }
      }
    } catch {
      setTemplates(DEFAULT_PRESETS);
      if (!selectedId) {
        onSelect(DEFAULT_PRESETS[0]);
      }
    }
  }, [category, onSelect, selectedId]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  return (
    <div className="flex items-center gap-1.5">
      <Layout className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Select 
        value={selectedId || DEFAULT_PRESETS[0].id} 
        onValueChange={(id) => {
          const t = templates.find(item => item.id === id);
          if (t) onSelect(t);
        }}
      >
        <SelectTrigger 
          className="h-7 w-auto min-w-[170px] max-w-[210px] text-xs font-medium text-foreground bg-background px-2.5 shadow-2xs gap-1.5" 
          aria-label="Select report template preset"
        >
          <SelectValue placeholder="Select template..." />
        </SelectTrigger>
        <SelectContent className="min-w-[240px]">
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id} textValue={t.name} className="text-xs cursor-pointer py-1.5">
              <div className="flex items-center justify-between w-full gap-2 min-w-0">
                <div className="flex flex-col min-w-0 text-left">
                  <span className="font-semibold text-foreground truncate">{t.name}</span>
                  {t.description && (
                    <span className="text-[10px] text-muted-foreground truncate leading-tight">
                      {t.description}
                    </span>
                  )}
                </div>
                {t.is_system && (
                  <span className="shrink-0 text-[9px] font-medium text-muted-foreground bg-muted border border-border/60 px-1.5 py-0.5 rounded">
                    Preset
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
          <SelectSeparator />
          <div 
            className="flex cursor-pointer items-center gap-2 p-2 text-[11px] font-medium text-primary hover:bg-muted rounded-sm transition-colors"
            onClick={(e) => {
              e.preventDefault();
              setEditorOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Create New Template
          </div>
        </SelectContent>
      </Select>
      
      <TemplateEditor 
        open={editorOpen} 
        onOpenChange={(val) => {
          setEditorOpen(val);
          if (!val) fetchTemplates(); // Refresh on close
        }} 
        category={category} 
      />
    </div>
  );
}
