"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardList, Eye, PenLine, Send, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { workflowProgress, type WorkflowSnapshot } from "@/lib/workflow-progress";
import { getCurrentUserOrganizationId } from "@/lib/org-scope";

const icons = [ClipboardList, Eye, PenLine, Send];
export function WorkflowProgress({
  studyId,
  worksheetId,
  revision,
  patientLabel,
  busy,
  compact = false,
}: {
  studyId?: string | null;
  worksheetId?: string;
  revision: string;
  patientLabel: string;
  busy: boolean;
  compact?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studyId) return;
    let active = true;
    let inFlight = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      setLoading(true);
      try {
        const organizationId = await getCurrentUserOrganizationId();
        if (!organizationId) throw new Error("Workflow organization unavailable");
        const study = await supabase
          .from("studies")
          .select("status")
          .eq("id", studyId!)
          .eq("organization_id", organizationId)
          .maybeSingle();
        let query = supabase
          .from("worksheets")
          .select("id, status, created_at, signed_at, signed_by")
          .eq("study_id", studyId!)
          .eq("organization_id", organizationId);
        if (worksheetId) query = query.eq("id", worksheetId);
        const worksheet = await query
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (study.error || worksheet.error || !study.data) throw new Error("Workflow unavailable");
        let reviewAt: string | null = null;
        let delivery: WorkflowSnapshot["delivery"] = null;
        if (worksheet.data) {
          const [review, message] = await Promise.all([
            supabase
              .from("audit_logs")
              .select("created_at")
              .eq("worksheet_id", worksheet.data.id)
              .eq("action", "send_to_doctor")
              .eq("status", "success")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("hl7_messages")
              .select("*")
              .eq("worksheet_id", worksheet.data.id)
              .eq("organization_id", organizationId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);
          // Audit events may be restricted to their author. Never invent a timestamp.
          reviewAt = review.data?.created_at ?? null;
          if (message.error) throw new Error("Delivery unavailable");
          delivery = message.data as WorkflowSnapshot["delivery"];
        }
        if (active) {
          setSnapshot({
            studyStatus: study.data.status,
            worksheet: worksheet.data,
            reviewAt,
            delivery,
          });
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }
    void load();
    let lastLoaded = Date.now();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        lastLoaded = Date.now();
        void load();
      }
    }, 30000);
    const onFocus = () => {
      if (Date.now() - lastLoaded > 15000) {
        lastLoaded = Date.now();
        void load();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [studyId, worksheetId, revision, refresh, busy]);

  const progress = snapshot ? workflowProgress(snapshot) : null;
  return (
    <section
      aria-label="Case progress"
      className={cn(
        "shrink-0 bg-card px-3 sm:px-4",
        compact
          ? "min-w-0 flex-1 border-t py-2 xl:border-t-0 xl:flex xl:items-center xl:gap-3"
          : "border-b py-3",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-xs",
          compact ? "mb-1.5 xl:mb-0 xl:shrink-0" : "mb-2.5 w-full",
        )}
      >
        <span className="font-semibold shrink-0 whitespace-nowrap">Case Progress</span>
        {patientLabel && (
          <span className="font-medium text-foreground whitespace-nowrap shrink-0">
            {patientLabel}
          </span>
        )}
        <span role="status" className="ml-auto shrink-0 whitespace-nowrap font-medium text-primary">
          {!studyId
            ? "Select a study"
            : error
              ? "Status unavailable"
              : busy
                ? "Updating…"
                : (progress?.summary ?? "Loading progress…")}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          aria-label="Refresh case progress"
          disabled={!studyId || loading || busy}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </div>
      {error && (
        <p role="alert" className="mb-2 flex items-center gap-1 text-xs text-muted-foreground w-full">
          <AlertCircle className="h-3.5 w-3.5" />
          Could not refresh progress.{" "}
          {snapshot ? "Last recorded status is shown below." : "Use refresh to try again."}
        </p>
      )}
      <ol
        className={cn("grid grid-cols-4 gap-2 w-full", compact && "xl:flex-1")}
        aria-label="Report workflow stages"
      >
        {(
          progress?.steps ??
          ["Worksheet", "Doctor Review", "Signed", "Sent"].map((label) => ({
            label,
            complete: false,
            time: null,
            detail: "—",
          }))
        ).map((step, index) => {
          const current = !!progress && progress.active === index;
          const Icon = step.complete ? Check : icons[index];
          const validTime = step.time && !Number.isNaN(Date.parse(step.time)) ? step.time : null;
          return (
            <li
              key={step.label}
              aria-current={current ? "step" : undefined}
              className={cn(
                "min-w-0 rounded-md border px-2 sm:px-3",
                compact ? "py-1.5" : "py-2",
                current
                  ? "border-primary/40 bg-primary/5"
                  : step.complete
                    ? "border-primary/20 bg-primary/5"
                    : "border-border bg-background",
              )}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold sm:text-xs">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    current || step.complete ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span>{step.label}</span>
                <span className="sr-only">
                  {step.complete ? "Completed" : current ? "Current stage" : "Pending"}
                </span>
              </div>
              <div className={cn("text-[10px] text-muted-foreground sm:text-[11px]", compact ? "mt-0.5" : "mt-1")}>
                {step.detail}
              </div>
              {validTime && !compact && (
                <time
                  dateTime={validTime}
                  className="mt-0.5 block text-[10px] text-muted-foreground"
                  title={new Date(validTime).toLocaleString()}
                >
                  {new Date(validTime).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
