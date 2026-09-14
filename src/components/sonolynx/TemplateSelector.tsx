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
  { id: "std", name: "Standard Clinical", description: "Standard clinical report", content_structure: "", is_system: true },
  { id: "fast", name: "Emergency/FAST Focus", description: "Focused assessment", content_structure: "", is_system: true },
  { id: "exec", name: "Executive Summary", description: "Concise summary", content_structure: "", is_system: true },
  { id: "point", name: "Point Form", description: "Bullet-point structure", content_structure: "", is_system: true },
  { id: "detail", name: "Research/Detailed", description: "Detailed anatomical survey", content_structure: "", is_system: true },
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
    <div className="flex items-center gap-2">
      <Layout className="h-3.5 w-3.5 text-muted-foreground" />
      <Select 
        value={selectedId || DEFAULT_PRESETS[0].id} 
        onValueChange={(id) => {
          const t = templates.find(item => item.id === id);
          if (t) onSelect(t);
        }}
      >
        <SelectTrigger className="h-7 w-[170px] text-xs" aria-label="Select report template">
          <SelectValue placeholder="Select template..." />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id} className="text-xs">
              <div className="flex flex-col">
                <span className="font-medium">{t.name}</span>
                {t.is_system && <span className="text-[10px] text-muted-foreground opacity-70">System Preset</span>}
              </div>
            </SelectItem>
          ))}
          <SelectSeparator />
          <div 
            className="flex cursor-pointer items-center gap-2 p-2 text-[10px] font-medium text-primary hover:bg-muted"
            onClick={(e) => {
              e.preventDefault();
              setEditorOpen(true);
            }}
          >
            <Plus className="h-3 w-3" />
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
