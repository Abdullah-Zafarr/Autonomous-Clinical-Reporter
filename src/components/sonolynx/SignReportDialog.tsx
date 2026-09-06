import type { ValidationIssue } from "@/lib/report-engine";
import type { Patient } from "@/lib/sonoflow-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SignReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  exam: string;
  accession: string;
  issues: ValidationIssue[];
  busy: boolean;
  onConfirm: () => void;
}

export function SignReportDialog({
  open,
  onOpenChange,
  patient,
  exam,
  accession,
  issues,
  busy,
  onConfirm,
}: SignReportDialogProps) {
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm final sign and send</AlertDialogTitle>
          <AlertDialogDescription>
            Review the patient and validation state before finalizing this report.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="font-semibold">
              {patient.lastName}, {patient.firstName}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <span>MRN: {patient.mrn}</span>
              <span>DOB: {patient.dob}</span>
              <span>Exam: {exam}</span>
              <span>Accession: {accession}</span>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
              <div className="font-semibold">Signing blocked</div>
              {errors.map((issue, index) => (
                <div key={`${issue.field}-${index}`} className="mt-1 text-xs">
                  {issue.message}
                </div>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <div className="font-semibold">Warnings</div>
              {warnings.map((issue, index) => (
                <div key={`${issue.field}-${index}`} className="mt-1 text-xs">
                  {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={busy || errors.length > 0} onClick={(event) => { event.preventDefault(); onConfirm(); }}>
            {busy ? "Sending..." : warnings.length > 0 ? "Confirm with Warnings" : "Sign & Send"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
