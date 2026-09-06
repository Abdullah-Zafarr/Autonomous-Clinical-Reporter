import { FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Patient } from "@/lib/sonoflow-types";
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
}

export function ReportHistory({ patient, items, loading, onOpen }: ReportHistoryProps) {
  return (
    <section className="border-t bg-card px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Report History</h2>
        </div>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {loading ? "Loading signed reports..." : "No signed reports for this patient yet."}
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((item) => {
            const reportText = item.report_text ?? "";
            const accession = item.studies?.accession_number ?? patient.accessionNumber ?? "Pending";
            const exam = item.studies?.exam_type ?? item.studies?.description ?? item.worksheet_type;
            const keyImages = item.data?.keyImages ?? item.form_data?.keyImages ?? [];
            return (
              <div key={item.id} className="min-w-64 rounded-md border bg-background p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{exam}</div>
                    <div className="mt-0.5 text-muted-foreground">{accession}</div>
                  </div>
                  <Badge variant={item.status === "failed" ? "destructive" : "secondary"}>{item.status}</Badge>
                </div>
                <div className="mt-2 text-muted-foreground">
                  Signed: {item.signed_at ? new Date(item.signed_at).toLocaleString() : "Pending"}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 flex-1" disabled={!reportText} onClick={() => onOpen(`Patient: ${patient.lastName}, ${patient.firstName}\nMRN: ${patient.mrn}\nExam: ${exam}\nAccession: ${accession}\nSigned: ${item.signed_at ?? "Pending"}\n\n${reportText}`, keyImages)}>
                    Open
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
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
                    className="h-7 w-7"
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
          })}
        </div>
      )}
    </section>
  );
}
