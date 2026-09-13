import { useState } from "react";
import { FileText, Activity, AlertCircle, Edit3, Check, BrainCircuit, Maximize2 } from "lucide-react";
import type { ReportSections } from "@/lib/report-engine";
import type { ValidationIssue } from "@/lib/clinical-validator";
import type { Patient } from "@/lib/sonoflow-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn, formatPatientName } from "@/lib/utils";
import { AiReportAssistantDialog } from "./AiReportAssistantDialog";
import { ReportCopilot } from "./ReportCopilot";
import { CorrectionPanel } from "@/components/sonolynx/CorrectionPanel";
import type { CorrectionFieldOption, KeyReportImage, WorksheetCorrection } from "@/lib/clinical-workflow-types";

interface Props {
  patient: Patient;
  accession: string;
  report: ReportSections;
  additionalNotes: string;
  validationIssues: ValidationIssue[];
  onPrint?: () => void;
  isDoctorMode?: boolean;
  canUseAiTools?: boolean;
  hasBeenEdited?: boolean;
  editableText?: string;
  onEditableTextChange?: (text: string) => void;
  onSign?: () => void;
  onSaveDraft?: () => void;
  onRetryDelivery?: () => void;
  busy?: boolean;
  dirty?: boolean;
  canSign?: boolean;
  worksheetId?: string;
  isSigned?: boolean;
  keyImages?: KeyReportImage[];
  correctionFields?: CorrectionFieldOption[];
  corrections?: WorksheetCorrection[];
  onCorrectionsChange?: (corrections: WorksheetCorrection[]) => void;
  currentUserId?: string;
  studyStatus?: string | null;
  returningForCorrection?: boolean;
  onReturnForCorrection?: () => void;
  onSelectKeyImage?: (image: KeyReportImage) => void;
}

export function ReportPreview({
  patient,
  accession,
  report,
  additionalNotes,
  validationIssues,
  onPrint,
  isDoctorMode,
  canUseAiTools = isDoctorMode,
  hasBeenEdited,
  editableText,
  onEditableTextChange,
  onSign,
  onSaveDraft,
  onRetryDelivery,
  busy = false,
  dirty = false,
  canSign = true,
  worksheetId,
  isSigned = false,
  keyImages = [],
  correctionFields = [],
  corrections = [],
  onCorrectionsChange,
  currentUserId = "",
  studyStatus,
  returningForCorrection,
  onReturnForCorrection,
  onSelectKeyImage,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const notes = additionalNotes.trim();
  const showAiTools = Boolean(isDoctorMode && canUseAiTools);

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden bg-card lg:border-l">
      <header className="shrink-0 border-b px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">{isDoctorMode ? "Clinical report" : "Report Preview"}</h2>
            <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wider">{dirty ? "UNSAVED" : isSigned ? "SIGNED" : "DRAFT"}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDoctorMode && (
              <>
                {showAiTools && <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/70 hover:bg-blue-100 hover:text-blue-800 gap-1.5 transition-all shadow-xs"
                  onClick={() => setAiAssistantOpen(true)}
                  disabled={busy}
                  title="Draft or enhance report with AI Clinical Assistant"
                >
                  <BrainCircuit className="h-3.5 w-3.5 text-blue-600" />
                  AI Drafter
                </Button>}
                <Button
                  variant={isEditing ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium tracking-wide gap-1.5"
                  onClick={() => setIsEditing(!isEditing)}
                  disabled={busy}
                >
                  {isEditing ? (
                    <><Check className="h-3.5 w-3.5" /> Done</>
                  ) : (
                    <><Edit3 className="h-3.5 w-3.5" /> Edit</>
                  )}
                </Button>
              </>
            )}
            {onPrint && <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={onPrint}>Preview / Export</Button>}
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

        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md bg-muted/40 px-3.5 py-2 text-xs">
          <span className="font-semibold text-foreground">
            {formatPatientName(patient)}
          </span>
          <span className="text-muted-foreground">
            MRN: <strong className="font-medium text-foreground">{patient.mrn}</strong>
          </span>
          <span className="text-muted-foreground">
            DOB: <strong className="font-medium text-foreground">{patient.dob}</strong>
          </span>
          <span className="text-muted-foreground">
            Accession: <strong className="font-medium text-foreground">{accession}</strong>
          </span>
        </div>
      </header>

      {showAiTools && <ReportCopilot
        key={`${patient.id}-${patient.studyId}-${worksheetId}-${isSigned}`}
        reportText={editableText || ""}
        worksheetId={worksheetId}
        signed={isSigned}
        patientLabel={`${formatPatientName(patient, "")} · ${accession}`}
        onApply={(text) => { onEditableTextChange?.(text); setIsEditing(true); }}
      />}

      {onCorrectionsChange && (
        <CorrectionPanel
          fields={correctionFields}
          corrections={corrections}
          onChange={onCorrectionsChange}
          isDoctorMode={!!isDoctorMode}
          currentUserId={currentUserId}
          studyStatus={studyStatus}
          returning={returningForCorrection}
          onReturn={onReturnForCorrection}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        <div className="max-w-4xl">
        {isDoctorMode && isEditing ? (
          <textarea
            aria-label="Clinical report text"
            disabled={busy}
            className="w-full min-h-72 resize-y bg-transparent border-0 p-0 text-sm leading-relaxed focus:outline-none focus:ring-0 text-foreground"
            value={editableText || ""}
            onChange={(e) => onEditableTextChange?.(e.target.value)}
            placeholder="Review and edit the report text here..."
            autoFocus
          />
        ) : hasBeenEdited ? (
          <div 
            className="text-sm leading-7 whitespace-pre-wrap text-foreground cursor-pointer hover:bg-muted/30 p-2 -m-2 rounded-md transition-colors"
            onClick={() => isDoctorMode && setIsEditing(true)}
            title={isDoctorMode ? "Click to edit report" : undefined}
          >
            {editableText}
          </div>
        ) : (
          <article 
            className={cn("space-y-6 text-sm leading-7 text-foreground", isDoctorMode && "cursor-pointer hover:bg-muted/30 p-2 -m-2 rounded-md transition-colors")}
            onClick={() => isDoctorMode && setIsEditing(true)}
            title={isDoctorMode ? "Click to edit report" : undefined}
          >
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <Activity className="h-3.5 w-3.5" />
                Findings
              </h3>
              <div className="space-y-2.5">
                {!report.findings.length && <p className="text-muted-foreground">No findings recorded yet. {isDoctorMode ? "Open a submitted case or edit the report to begin your review." : "Complete the worksheet to generate findings."}</p>}
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
            {keyImages.length > 0 && (
              <section className="mt-4 pt-3 border-t break-inside-avoid-page">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Attached Key Images</h3>
                    <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
                      {keyImages.length}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Click to inspect in viewer</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {keyImages.map((image) => (
                    <figure
                      key={image.id}
                      onClick={() => onSelectKeyImage?.(image)}
                      className={cn(
                        "group relative w-28 sm:w-32 shrink-0 overflow-hidden rounded-md border bg-slate-950 transition-all",
                        onSelectKeyImage && "cursor-pointer hover:border-primary hover:ring-1 hover:ring-primary/30 hover:shadow-xs"
                      )}
                      title={`Click to view "${image.caption}" in DICOM viewer`}
                    >
                      <div className="relative h-18 sm:h-20 w-full overflow-hidden bg-black flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.dataUrl}
                          alt={image.caption}
                          className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-medium text-white shadow border border-slate-700 flex items-center gap-1">
                            <Maximize2 className="h-2.5 w-2.5" /> View
                          </span>
                        </div>
                      </div>
                      <figcaption className="flex items-center justify-between bg-card px-2 py-1 font-sans text-[10px] text-foreground border-t">
                        <span className="font-medium truncate max-w-[75px]">{image.caption}</span>
                        <span className="text-[9px] text-muted-foreground shrink-0">F{image.frameNumber}</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            )}
        </div>
      </div>

      {isDoctorMode ? (
        <footer className="shrink-0 border-t px-4 py-3 sm:px-5 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 text-xs">
              <span className="font-medium text-foreground">{dirty ? "Unsaved changes" : "Clinician review"}</span>
              <span className="hidden text-muted-foreground sm:inline">•</span>
              <span className="text-[11px] text-muted-foreground">
                {isSigned ? (dirty ? "Changes will create a new revision" : "Signed report saved") : "Awaiting signature"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onSaveDraft && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || !dirty}
                  onClick={onSaveDraft}
                >
                  Save draft
                </Button>
              )}
              {onRetryDelivery && (
                <Button variant="outline" size="sm" disabled={busy || dirty} onClick={onRetryDelivery}>
                  Retry delivery
                </Button>
              )}
              <Button
                disabled={busy || !canSign || (isSigned && !dirty)}
                size="sm"
                variant="default"
                className="font-semibold shadow-xs"
                onClick={onSign}
              >
                {busy ? "Saving…" : isSigned && dirty ? "Sign new revision" : isSigned ? "Report signed" : "Sign & finalize"}
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
        open={showAiTools && aiAssistantOpen}
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
