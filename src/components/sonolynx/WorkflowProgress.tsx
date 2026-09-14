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
  className,
}: {
  studyId?: string | null;
  worksheetId?: string;
  revision: string;
  patientLabel: string;
  busy: boolean;
  compact?: boolean;
  className?: string;
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
        "shrink-0 border-b bg-card px-3 sm:px-4 py-1 w-full",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 w-full min-h-7">
        <div className="flex items-center gap-1.5 shrink-0 text-xs">
          <span className="font-semibold text-foreground whitespace-nowrap">Case Progress</span>
          {patientLabel && (
            <span className="font-medium text-muted-foreground whitespace-nowrap" suppressHydrationWarning>
              · {patientLabel}
            </span>
          )}
        </div>

        <ol
          className="flex flex-wrap items-center gap-1.5 py-0.5"
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
                "flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium border transition-colors whitespace-nowrap",
                current
                  ? "border-primary/50 bg-primary/10 text-primary font-semibold shadow-xs"
                  : step.complete
                    ? "border-primary/20 bg-primary/5 text-foreground"
                    : "border-border/60 bg-muted/20 text-muted-foreground"
              )}
              title={`${step.label}: ${step.detail}${validTime ? ` (${new Date(validTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })})` : ""}`}
            >
              <Icon
                className={cn(
                  "h-3 w-3 shrink-0",
                  current || step.complete ? "text-primary" : "text-muted-foreground/60"
                )}
              />
              <span>{step.label}</span>
              <span className="sr-only">
                {step.complete ? "Completed" : current ? "Current stage" : "Pending"}
              </span>
              <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">
                · {step.detail}
              </span>
            </li>
          );
        })}
        </ol>

        <div className="flex items-center gap-1.5 ml-auto shrink-0 text-xs">
          <span role="status" className="whitespace-nowrap text-[11px] font-medium text-primary">
            {!studyId
              ? "Select a study"
              : error
                ? "Status unavailable"
                : busy
                  ? "Updating…"
                  : (progress?.summary ?? "Loading…")}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Refresh case progress"
            disabled={!studyId || loading || busy}
            onClick={() => setRefresh((value) => value + 1)}
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground w-full">
          <AlertCircle className="h-3 w-3" />
          Could not refresh progress.{" "}
          {snapshot ? "Last recorded status is shown." : "Use refresh to try again."}
        </p>
      )}
    </section>
  );
}
