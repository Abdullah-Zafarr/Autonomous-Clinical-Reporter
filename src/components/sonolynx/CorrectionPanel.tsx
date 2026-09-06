"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CornerDownLeft, MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { CorrectionFieldOption, WorksheetCorrection } from "@/lib/clinical-workflow-types";

interface Props {
  fields: CorrectionFieldOption[];
  corrections: WorksheetCorrection[];
  onChange: (corrections: WorksheetCorrection[]) => void;
  isDoctorMode: boolean;
  currentUserId: string;
  studyStatus?: string | null;
  returning?: boolean;
  onReturn?: () => void;
}

export function CorrectionPanel({
  fields,
  corrections,
  onChange,
  isDoctorMode,
  currentUserId,
  studyStatus,
  returning = false,
  onReturn,
}: Props) {
  const [fieldPath, setFieldPath] = useState(fields[0]?.path ?? "");
  const [comment, setComment] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const openCorrections = useMemo(() => corrections.filter((item) => item.status === "open"), [corrections]);
  const selectedField = fields.find((field) => field.path === fieldPath) ?? fields[0];

  const addCorrection = () => {
    if (!selectedField || !comment.trim()) return;
    onChange([
      ...corrections,
      {
        id: crypto.randomUUID(),
        fieldPath: selectedField.path,
        fieldLabel: selectedField.label,
        comment: comment.trim(),
        status: "open",
        requestedBy: currentUserId,
        requestedAt: new Date().toISOString(),
      },
    ]);
    setComment("");
  };

  const resolve = (id: string) => {
    onChange(
      corrections.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "resolved",
              resolutionNote: resolutionNotes[id]?.trim() || "Corrected in worksheet",
              resolvedBy: currentUserId,
              resolvedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  };

  if (!isDoctorMode && corrections.length === 0) return null;

  return (
    <details open={corrections.length > 0 || undefined} className="mx-4 mt-3 shrink-0 rounded-lg border bg-muted/20 p-3 sm:mx-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <h3 className="text-xs font-medium">Worksheet corrections</h3>
        <Badge variant="outline" className="ml-auto border-amber-300 bg-white text-[10px]">
          {openCorrections.length} open
        </Badge>
      </summary>

      {corrections.length > 0 && (
        <div className="mt-3 space-y-2">
          {corrections.map((item) => (
            <div key={item.id} className="rounded-md border bg-white p-2.5">
              <div className="flex items-start gap-2">
                {item.status === "resolved" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <CornerDownLeft className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{item.fieldLabel}</p>
                  <p className="mt-0.5 text-xs text-slate-700">{item.comment}</p>
                  {item.status === "resolved" && (
                    <p className="mt-1 text-[11px] text-emerald-700">Resolved: {item.resolutionNote}</p>
                  )}
                </div>
                {isDoctorMode && studyStatus !== "correction_requested" && item.status === "open" && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-slate-500 hover:text-red-600"
                    onClick={() => onChange(corrections.filter((correction) => correction.id !== item.id))}
                    aria-label={`Remove correction request for ${item.fieldLabel}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {!isDoctorMode && item.status === "open" && (
                <div className="mt-2 flex gap-2">
                  <Textarea
                    className="min-h-16 bg-white text-xs"
                    placeholder="What was corrected? (optional)"
                    value={resolutionNotes[item.id] ?? ""}
                    onChange={(event) => setResolutionNotes((notes) => ({ ...notes, [item.id]: event.target.value }))}
                  />
                  <Button type="button" size="sm" className="self-end" onClick={() => resolve(item.id)}>
                    Resolve
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isDoctorMode && studyStatus !== "correction_requested" && (
        <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
          <select
            value={fieldPath}
            onChange={(event) => setFieldPath(event.target.value)}
            className="h-9 w-full rounded-md border bg-white px-2 text-xs"
            aria-label="Worksheet field requiring correction"
          >
            {fields.map((field) => (
              <option key={field.path} value={field.path}>
                {field.label} — {field.value}
              </option>
            ))}
          </select>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Describe what needs correction"
            className="min-h-20 bg-white text-xs"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!comment.trim() || !selectedField} onClick={addCorrection}>
              <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" /> Add request
            </Button>
            <Button type="button" size="sm" disabled={openCorrections.length === 0 || returning} onClick={onReturn}>
              <CornerDownLeft className="mr-1.5 h-3.5 w-3.5" />
              {returning ? "Returning…" : "Return to sonographer"}
            </Button>
          </div>
        </div>
      )}

      {!isDoctorMode && openCorrections.length === 0 && corrections.length > 0 && (
        <p className="mt-3 text-xs font-medium text-emerald-700">All requests are resolved. Save and resubmit the case for review.</p>
      )}
    </details>
  );
}
