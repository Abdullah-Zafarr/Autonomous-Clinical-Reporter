"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  CornerDownLeft,
  History,
  MessageSquarePlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CorrectionFieldOption, WorksheetCorrection } from "@/lib/clinical-workflow-types";

interface Props {
  fields: CorrectionFieldOption[];
  corrections: WorksheetCorrection[];
  onChange?: (corrections: WorksheetCorrection[]) => void;
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Active vs Archived / Dismissed / Accepted corrections
  const activeCorrections = useMemo(
    () =>
      corrections.filter(
        (item) => !item.archived && item.status !== "dismissed" && item.status !== "accepted",
      ),
    [corrections],
  );

  const historyCorrections = useMemo(
    () =>
      corrections.filter(
        (item) => item.archived || item.status === "accepted" || item.status === "dismissed",
      ),
    [corrections],
  );

  const resolvedReceivedCorrections = useMemo(
    () => activeCorrections.filter((item) => item.status === "resolved"),
    [activeCorrections],
  );

  const openCorrections = useMemo(
    () => activeCorrections.filter((item) => item.status === "open"),
    [activeCorrections],
  );

  const selectedField = fields.find((field) => field.path === fieldPath) ?? fields[0];

  const addCorrection = () => {
    if (!selectedField || !comment.trim() || !onChange) return;
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
    setShowAddForm(false);
    toast.success("Correction request added");
  };

  const resolve = (id: string) => {
    if (!onChange) return;
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
    toast.success("Correction resolved");
  };

  // Doctor clicks Tick (✓): Accept correction and archive to history
  const handleAccept = (id: string) => {
    if (!onChange) return;
    const target = corrections.find((c) => c.id === id);
    const updated = corrections.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "accepted" as const,
            archived: true,
            resolvedAt: item.resolvedAt || new Date().toISOString(),
            resolvedBy: item.resolvedBy || currentUserId,
          }
        : item,
    );
    onChange(updated);
    toast.success(`Accepted correction for ${target?.fieldLabel || "worksheet"} (moved to history)`);

    // If no more active corrections remain, collapse panel to save screen space
    const remainingActive = updated.filter(
      (item) => !item.archived && item.status !== "dismissed" && item.status !== "accepted",
    );
    if (remainingActive.length === 0) {
      setIsExpanded(false);
    }
  };

  // Doctor clicks Cross (✗): Dismiss correction and archive to history
  const handleDismiss = (id: string) => {
    if (!onChange) return;
    const target = corrections.find((c) => c.id === id);
    const updated = corrections.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "dismissed" as const,
            archived: true,
          }
        : item,
    );
    onChange(updated);
    toast.info(`Dismissed correction for ${target?.fieldLabel || "worksheet"} (moved to history)`);

    // If no more active corrections remain, collapse panel to save screen space
    const remainingActive = updated.filter(
      (item) => !item.archived && item.status !== "dismissed" && item.status !== "accepted",
    );
    if (remainingActive.length === 0) {
      setIsExpanded(false);
    }
  };

  // If sonographer mode and no corrections exist, hide completely
  if (!isDoctorMode && corrections.length === 0) return null;

  // In doctor mode: if no corrections exist and doctor hasn't clicked "request correction", render a compact link
  if (isDoctorMode && corrections.length === 0) {
    if (!showAddForm) {
      return (
        <div className="mx-4 mt-2 shrink-0 sm:mx-5 max-w-4xl flex items-center justify-end">
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/50 cursor-pointer"
          >
            <Plus className="h-3 w-3" /> Request correction from sonographer
          </button>
        </div>
      );
    }
  }

  const hasReceived = resolvedReceivedCorrections.length > 0;
  const hasOpen = openCorrections.length > 0;

  return (
    <div
      className={cn(
        "mx-4 mt-2.5 shrink-0 rounded-lg border transition-all duration-150 sm:mx-5 max-w-4xl",
        hasReceived
          ? "border-emerald-300 bg-emerald-50/50 shadow-2xs"
          : hasOpen
            ? "border-amber-300 bg-amber-50/40 shadow-2xs"
            : "border-border/80 bg-muted/20",
      )}
    >
      {/* Clickable compact header summary */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left outline-none transition-colors group rounded-lg",
          hasReceived ? "hover:bg-emerald-100/40" : hasOpen ? "hover:bg-amber-100/40" : "hover:bg-muted/40",
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {hasReceived ? (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
            </span>
          ) : hasOpen ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          ) : (
            <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
            <h3 className={cn(
              "text-xs font-semibold truncate",
              hasReceived ? "text-emerald-950 font-bold" : hasOpen ? "text-amber-950" : "text-foreground"
            )}>
              {hasReceived
                ? `${resolvedReceivedCorrections.length} correction${
                    resolvedReceivedCorrections.length > 1 ? "s" : ""
                  } received`
                : hasOpen
                  ? `${openCorrections.length} correction request${
                      openCorrections.length > 1 ? "s" : ""
                    } open`
                  : historyCorrections.length > 0
                    ? "Worksheet corrections (all archived)"
                    : "Worksheet corrections"}
            </h3>
            <span className={cn(
              "text-[11px] transition-colors",
              hasReceived ? "text-emerald-700/80 group-hover:text-emerald-900" : "text-muted-foreground group-hover:text-foreground"
            )}>
              · {isExpanded ? "Click to collapse" : "Click to view correction"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasReceived && (
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 shadow-2xs">
              {resolvedReceivedCorrections.length} received
            </Badge>
          )}
          {hasOpen && (
            <Badge
              variant="outline"
              className="border-amber-300 bg-white text-amber-800 text-[10px] font-semibold px-2 py-0.5"
            >
              {openCorrections.length} open
            </Badge>
          )}
          {!hasReceived && !hasOpen && historyCorrections.length > 0 && (
            <Badge variant="outline" className="border-border bg-white text-muted-foreground text-[10px]">
              {historyCorrections.length} in history
            </Badge>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180 text-foreground",
            )}
          />
        </div>
      </button>

      {/* Expanded view */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-2 space-y-3 border-t border-border/60">
          {/* Active corrections */}
          {activeCorrections.length > 0 ? (
            <div className="space-y-2">
              {activeCorrections.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs transition-all hover:border-slate-300"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {item.status === "resolved" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <CornerDownLeft className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900">{item.fieldLabel}</p>
                          {item.status === "resolved" && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
                            >
                              Resolved by sonographer
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-700">{item.comment}</p>
                        {item.status === "resolved" && (
                          <div className="mt-1.5 rounded-md bg-emerald-50/80 border border-emerald-200/80 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
                            Resolved: {item.resolutionNote || "Corrected in worksheet"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tick (✓) and Cross (✗) circular action buttons for Doctor */}
                    {isDoctorMode && (
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleAccept(item.id)}
                          title="Accept correction & archive to history"
                          aria-label={`Accept correction for ${item.fieldLabel}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-emerald-600 shadow-2xs transition-all hover:scale-110 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white active:scale-95 cursor-pointer"
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismiss(item.id)}
                          title="Dismiss correction & move to history"
                          aria-label={`Dismiss correction for ${item.fieldLabel}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-300 bg-rose-50 text-rose-600 shadow-2xs transition-all hover:scale-110 hover:border-rose-600 hover:bg-rose-600 hover:text-white active:scale-95 cursor-pointer"
                        >
                          <X className="h-4 w-4 stroke-[3]" />
                        </button>
                      </div>
                    )}

                    {/* Sonographer remove button for newly created draft requests */}
                    {!isDoctorMode && item.status === "open" && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-slate-500 hover:text-red-600"
                        onClick={() => onChange?.(corrections.filter((c) => c.id !== item.id))}
                        aria-label={`Remove correction request for ${item.fieldLabel}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Sonographer resolve form */}
                  {!isDoctorMode && item.status === "open" && (
                    <div className="mt-2.5 flex gap-2 border-t border-slate-100 pt-2">
                      <Textarea
                        className="min-h-14 bg-white text-xs"
                        placeholder="What was corrected? (e.g. 13 was the actual size)"
                        value={resolutionNotes[item.id] ?? ""}
                        onChange={(event) =>
                          setResolutionNotes((notes) => ({ ...notes, [item.id]: event.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="self-end h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => resolve(item.id)}
                      >
                        Resolve
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border/80 bg-white/50 p-3 text-center text-xs text-muted-foreground">
              No active corrections. All items have been resolved or acknowledged.
            </div>
          )}

          {/* Archived History drawer */}
          {historyCorrections.length > 0 && (
            <div className="rounded-md border border-slate-200/80 bg-white/70 p-2.5">
              <button
                type="button"
                onClick={() => setHistoryOpen(!historyOpen)}
                className="flex w-full items-center justify-between text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <div className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-slate-500" />
                  <span>Correction History ({historyCorrections.length})</span>
                </div>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200 text-slate-400",
                    historyOpen && "rotate-180",
                  )}
                />
              </button>

              {historyOpen && (
                <div className="mt-2 space-y-1.5 pt-2 border-t border-slate-100">
                  {historyCorrections.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-md border bg-slate-50 px-2.5 py-1.5 text-[11px]"
                    >
                      <div className="min-w-0 flex-1 truncate mr-2">
                        <span className="font-semibold text-slate-800">{item.fieldLabel}</span>:{" "}
                        <span className="text-slate-600">{item.comment}</span>
                        {item.resolutionNote && (
                          <span className="ml-1 text-emerald-700 font-medium">
                            · Resolved: {item.resolutionNote}
                          </span>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] shrink-0 font-medium",
                          item.status === "accepted" && "border-emerald-300 bg-emerald-50 text-emerald-700",
                          item.status === "dismissed" && "border-rose-200 bg-rose-50 text-rose-700",
                        )}
                      >
                        {item.status === "accepted"
                          ? "Accepted"
                          : item.status === "dismissed"
                            ? "Dismissed"
                            : "Archived"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Doctor Mode: Request new correction from sonographer */}
          {isDoctorMode && studyStatus !== "correction_requested" && (
            <div className="border-t border-slate-200/80 pt-2">
              {!showAddForm ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 gap-1 px-2"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Request new correction from sonographer
                </Button>
              ) : (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">
                      Request field correction from sonographer
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[11px] text-slate-500 hover:text-slate-800"
                      onClick={() => setShowAddForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                  <select
                    value={fieldPath}
                    onChange={(event) => setFieldPath(event.target.value)}
                    className="h-8 w-full rounded-md border bg-white px-2 text-xs"
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
                    className="min-h-16 bg-white text-xs"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!comment.trim() || !selectedField}
                      onClick={addCorrection}
                    >
                      <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" /> Add request
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={openCorrections.length === 0 || returning}
                      onClick={onReturn}
                    >
                      <CornerDownLeft className="mr-1.5 h-3.5 w-3.5" />
                      {returning ? "Returning…" : "Return to sonographer"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isDoctorMode && openCorrections.length === 0 && corrections.length > 0 && (
            <p className="text-xs font-medium text-emerald-700">
              All requests are resolved. Save and resubmit the case for review.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
