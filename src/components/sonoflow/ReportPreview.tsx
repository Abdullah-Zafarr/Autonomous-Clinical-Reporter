import { useState } from "react";
import { FileText, Activity, AlertCircle, Edit3, Check, Sparkles } from "lucide-react";
import type { ReportSections } from "@/lib/report-engine";
import type { ValidationIssue } from "@/lib/clinical-validator";
import type { Patient } from "@/lib/sonoflow-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AiReportAssistantDialog } from "./AiReportAssistantDialog";

interface Props {
  patient: Patient;
  accession: string;
  report: ReportSections;
  additionalNotes: string;
  validationIssues: ValidationIssue[];
  onPrint?: () => void;
  isDoctorMode?: boolean;
  hasBeenEdited?: boolean;
  editableText?: string;
  onEditableTextChange?: (text: string) => void;
  onSign?: () => void;
}

export function ReportPreview({
  patient,
  accession,
  report,
  additionalNotes,
  validationIssues,
  onPrint,
  isDoctorMode,
  hasBeenEdited,
  editableText,
  onEditableTextChange,
  onSign,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const notes = additionalNotes.trim();

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden bg-card lg:border-l">
      <header className="border-b px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Report Preview</h2>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">LIVE</Badge>
            {isDoctorMode && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] font-semibold text-blue-600 border-blue-200 bg-blue-50/70 hover:bg-blue-100 hover:text-blue-800 gap-1 transition-all shadow-xs"
                  onClick={() => setAiAssistantOpen(true)}
                  title="Draft or enhance report with AI Clinical Assistant"
                >
                  <Sparkles className="h-3 w-3 text-blue-600" />
                  AI Drafter
                </Button>
                <Button
                  variant={isEditing ? "default" : "outline"}
                  size="sm"
                  className="h-6 px-2.5 text-[10px] font-semibold tracking-wide"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? (
                    <><Check className="mr-1.5 h-3 w-3" /> Done</>
                  ) : (
                    <><Edit3 className="mr-1.5 h-3 w-3" /> Edit</>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {validationIssues.length > 0 && (
          <div className={cn(
            "mt-3 rounded-md border p-3",
            validationIssues.some(i => i.level === "error") 
              ? "bg-red-50 border-red-200" 
              : "bg-amber-50 border-amber-200"
          )}>
            <div className="flex items-center gap-2 mb-1.5">
               <AlertCircle className={cn(
                 "h-3.5 w-3.5",
                 validationIssues.some(i => i.level === "error") ? "text-red-600" : "text-amber-600"
               )} />
               <span className={cn(
                 "text-[11px] font-bold uppercase tracking-wider",
                 validationIssues.some(i => i.level === "error") ? "text-red-700" : "text-amber-700"
               )}>
                 Clinical Alerts
               </span>
            </div>
            <ul className="space-y-1">
              {validationIssues.map((issue, idx) => (
                <li key={idx} className={cn(
                  "text-[11px] font-medium leading-tight",
                  issue.level === "error" ? "text-red-600" : "text-amber-700"
                )}>
                  • {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs">
          <div className="font-semibold text-foreground">
            {patient.lastName}, {patient.firstName}
          </div>
          <div className="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
            <span>MRN: {patient.mrn}</span>
            <span>DOB: {patient.dob}</span>
            <span className="col-span-2">Accession: {accession}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        {isDoctorMode && isEditing ? (
          <textarea
            className="w-full h-full min-h-[500px] resize-none bg-transparent border-0 p-0 font-mono text-[13px] leading-relaxed focus:outline-none focus:ring-0 text-foreground"
            value={editableText || ""}
            onChange={(e) => onEditableTextChange?.(e.target.value)}
            placeholder="Review and edit the report text here..."
            autoFocus
          />
        ) : hasBeenEdited ? (
          <div 
            className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-foreground cursor-pointer hover:bg-muted/30 p-2 -m-2 rounded-md transition-colors"
            onClick={() => isDoctorMode && setIsEditing(true)}
            title={isDoctorMode ? "Click to edit report" : undefined}
          >
            {editableText}
          </div>
        ) : (
          <article 
            className={cn("space-y-6 font-mono text-[13px] leading-relaxed text-foreground", isDoctorMode && "cursor-pointer hover:bg-muted/30 p-2 -m-2 rounded-md transition-colors")}
            onClick={() => isDoctorMode && setIsEditing(true)}
            title={isDoctorMode ? "Click to edit report" : undefined}
          >
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <Activity className="h-3.5 w-3.5" />
                Findings
              </h3>
              <div className="space-y-2.5">
                {report.findings.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
                Impression
              </h3>
              <ol className="space-y-1.5">
                {report.impression.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-semibold text-muted-foreground">{i + 1}.</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </section>
            {report.recommendations && report.recommendations.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
                  Recommendations
                </h3>
                <ol className="space-y-1.5">
                  {report.recommendations.map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-semibold text-muted-foreground">{i + 1}.</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <Separator />

            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
                Additional Notes
              </h3>
              {notes ? (
                <p className="whitespace-pre-wrap">{notes}</p>
              ) : (
                <p className="italic text-muted-foreground">
                  No additional notes. Add manual notes from the worksheet panel.
                </p>
              )}
            </section>
          </article>
        )}
      </div>

      {isDoctorMode ? (
        <footer className="border-t px-4 py-3 sm:px-5 bg-card">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center text-[11px] text-muted-foreground">
              <span>Doctor Review Mode</span>
              <span>Pending Doctor Signature</span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-800 gap-1.5 transition-all"
                onClick={() => setAiAssistantOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                Draft with AI
              </Button>
              <Button variant="default" className="flex-1 font-bold" onClick={onSign}>
                Sign & Finalize Report
              </Button>
            </div>
          </div>
        </footer>
      ) : (
        <footer className="border-t px-4 py-3 text-[11px] text-muted-foreground sm:px-5">
          Electronically generated · Sonolynx Radiology · Pending sonographer signature
        </footer>
      )}

      <AiReportAssistantDialog
        open={aiAssistantOpen}
        onOpenChange={setAiAssistantOpen}
        examType={patient.exam || "Ultrasound"}
        patient={patient}
        currentReportText={editableText}
        onApplyReport={(text) => {
          onEditableTextChange?.(text);
          setIsEditing(true);
        }}
      />
    </aside>
  );
}
