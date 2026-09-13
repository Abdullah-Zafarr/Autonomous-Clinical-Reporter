import { FileText, Download, Loader2, Calendar, User, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Patient } from "@/lib/sonoflow-types";
import { formatPatientName } from "@/lib/utils";
import { downloadReportTextAsPdf, exportReportToPdf } from "@/lib/pdf-export";
import { toast } from "sonner";
import type { KeyReportImage } from "@/lib/clinical-workflow-types";

interface ReportHistoryItem {
  id: string;
  worksheet_type: string;
  status: string;
  report_text: string | null;
  signed_at: string | null;
  signed_by: string | null;
  data?: { keyImages?: KeyReportImage[] } | null;
  form_data?: { keyImages?: KeyReportImage[] } | null;
  studies?: {
    accession_number?: string | null;
    exam_type?: string | null;
    description?: string | null;
  } | null;
}

interface ReportHistoryProps {
  patient: Patient;
  items: ReportHistoryItem[];
  loading: boolean;
  onOpen: (reportText: string, keyImages: KeyReportImage[]) => void;
  onClose?: () => void;
}

export function ReportHistory({ patient, items, loading, onOpen, onClose }: ReportHistoryProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex items-center justify-between border-b pl-4 pr-12 py-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold leading-tight text-foreground">Report History</h2>
              {items.length > 0 && (
                <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0.5">
                  {items.length} {items.length === 1 ? "report" : "reports"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {formatPatientName(patient, "No patient selected")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2.5 text-center text-muted-foreground px-4">
            <div className="rounded-full bg-muted/50 p-3">
              <FileText className="h-6 w-6 opacity-40" />
            </div>
            <p className="text-xs font-medium">
              {loading ? "Loading signed reports..." : "No signed reports found for this patient."}
            </p>
            <p className="text-[11px] text-muted-foreground/70 max-w-[220px]">
              Signed reports will appear here automatically for future reference and printing.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const reportText = item.report_text ?? "";
            const accession = item.studies?.accession_number ?? patient.accessionNumber ?? "Pending";
            const exam = item.studies?.exam_type ?? item.studies?.description ?? item.worksheet_type;
            const keyImages = item.data?.keyImages ?? item.form_data?.keyImages ?? [];
            return (
              <div
                key={item.id}
                className="w-full rounded-lg border border-border/80 bg-background p-3.5 text-xs shadow-sm transition-all hover:border-slate-700/80 hover:shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-foreground truncate">{exam}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                      <Hash className="h-3 w-3 shrink-0 opacity-60" />
                      <span className="truncate">{accession}</span>
                    </div>
                  </div>
                  <Badge
                    variant={item.status === "failed" ? "destructive" : "secondary"}
                    className="shrink-0 capitalize text-[10px] font-medium"
                  >
                    {item.status}
                  </Badge>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 shrink-0 opacity-60" />
                    Signed:
                  </span>
                  <span className="font-medium text-foreground/90 truncate ml-1">
                    {item.signed_at ? new Date(item.signed_at).toLocaleString() : "Pending"}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-xs font-medium"
                    disabled={!reportText}
                    onClick={() =>
                      onOpen(
                        `Patient: ${formatPatientName(patient, "")}\nMRN: ${patient.mrn}\nExam: ${exam}\nAccession: ${accession}\nSigned: ${item.signed_at ?? "Pending"}\n\n${reportText}`,
                        keyImages
                      )
                    }
                  >
                    Open
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 shrink-0"
                    disabled={!reportText}
                    onClick={() => {
                      try {
                        exportReportToPdf({
                          patient,
                          accession,
                          exam,
                          reportText,
                          signedBy: item.signed_by,
                          signedAt: item.signed_at,
                          keyImages,
                        });
                      } catch (error) {
                        toast.error("Unable to open print preview", {
                          description: error instanceof Error ? error.message : "Please try again.",
                        });
                      }
                    }}
                    title="Print PDF"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 shrink-0"
                    disabled={!reportText}
                    onClick={() => {
                      void downloadReportTextAsPdf({
                        patient,
                        accession,
                        exam,
                        reportText,
                        signedBy: item.signed_by,
                        signedAt: item.signed_at,
                        keyImages,
                      }).catch((error) => {
                        toast.error("PDF download failed", {
                          description: error instanceof Error ? error.message : "Please try again.",
                        });
                      });
                    }}
                    title="Download PDF"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
