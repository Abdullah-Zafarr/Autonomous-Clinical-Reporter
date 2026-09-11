import { Search, User, Loader2, Stethoscope, AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { type Patient } from "@/lib/sonoflow-types";
import { useEffect, useRef, useState, useCallback } from "react";
import { cn, formatPatientName } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserOrganizationId } from "@/lib/org-scope";
import { mockPatients } from "@/lib/sonoflow-types";
import { useAuth } from "@/lib/auth-context";

const demoDataEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "true";

interface Props {
  selectedId: string;
  selectedStudyId?: string;
  onSelect: (p: Patient) => void;
  onDelete?: (deletedPatientId: string) => void;
  refreshKey?: number;
}

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await (supabase as any).auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

// ----------------------------------------------------------------
// Mappers
// ----------------------------------------------------------------

/** Map a raw `studies` row (with embedded `patients`) to the UI Patient object. */
function studyRowToPatient(row: any): Patient {
  const pat = row.patients ?? {};
  // Use patient_id (not study id) as the patient identifier — this is what the
  // worksheet and report system keys off of. studyId carries the study's own id.
  const patientId = pat.id ?? row.patient_id;
  return {
    id: patientId ?? row.id, // patient record id
    mrn: pat.mrn ?? "—",
    firstName: pat.first_name ?? "",
    lastName: pat.last_name ?? "",
    dob: pat.dob ?? "—",
    exam: row.exam_type || row.description || "Ultrasound",
    studyId: row.id,             // study record id — critical for worksheet loading
    accessionNumber: row.accession_number ?? null,
    studyStatus: row.status ?? null,
  };
}

/** Map a raw `patients` row (with embedded `studies`) to the UI Patient object.
 *  Used for the sonographer / non-doctor path. */
function patientRowToPatient(p: any, role: string | null, userId?: string): Patient {
  const studies: any[] = Array.isArray(p.studies) ? p.studies : [];
  let study = studies.find((s) => s.assigned_to === userId && s.status === "review_pending");
  if (!study) study = studies.find((s) => s.assigned_to === userId);
  if (!study) study = studies.find((s) => s.status === "review_pending");
  if (!study) study = studies[0] ?? null;

  return {
    id: p.id,
    mrn: p.mrn,
    firstName: p.first_name,
    lastName: p.last_name,
    dob: p.dob,
    exam: study?.exam_type || study?.description || "Ultrasound",
    studyId: study?.id,
    accessionNumber: study?.accession_number,
    studyStatus: study?.status,
  };
}

// ----------------------------------------------------------------
// Doctor worklist: query studies WHERE assigned_to = auth.uid()
// We intentionally DO NOT filter by status so we catch all studies
// that are assigned — regardless of what status they ended up in.
// ----------------------------------------------------------------
async function fetchDoctorWorklist(userId: string): Promise<{ patients: Patient[]; debugInfo: string }> {
  const organizationId = await getCurrentUserOrganizationId();
  if (!organizationId) {
    return { patients: [], debugInfo: "No organization context; worklist is hidden until clinic membership is assigned." };
  }
  // Step 1: query all studies assigned to this doctor (no status filter — we want
  // to see everything the sonographer sent, even if status didn't get updated).
  const { data, error } = await (supabase as any)
    .from("studies")
    .select(
      "id, accession_number, assigned_to, description, exam_type, status, patient_id, study_date," +
        "patients:patient_id(id, mrn, first_name, last_name, dob)"
    )
    .eq("assigned_to", userId)
    .eq("organization_id", organizationId)
    .order("study_date", { ascending: false })
    .limit(100);

  const debugInfo = `Query: studies WHERE assigned_to=${userId.slice(0, 8)}… | rows=${data?.length ?? 0} | error=${error ? JSON.stringify({ code: error.code, message: error.message }) : "none"}`;

  if (error) {
    throw Object.assign(new Error(error.message), { debugInfo, supabaseCode: error.code });
  }

  if (!data || data.length === 0) {
    return { patients: [], debugInfo };
  }

  return {
    patients: (data as any[]).map(studyRowToPatient),
    debugInfo,
  };
}

// ----------------------------------------------------------------
// Sonographer / generic worklist: query patients table
// ----------------------------------------------------------------
async function fetchSonographerWorklist(role: string | null, userId?: string): Promise<Patient[]> {
  const organizationId = await getCurrentUserOrganizationId();

  // A missing organisation is an authentication/data-integrity problem. Do
  // not fall back to a shared or unscoped worklist that could expose another
  // clinic's patients.
  if (!organizationId) return [];

  let query = (supabase as any)
    .from("patients")
    .select(
      "id, mrn, first_name, last_name, dob, studies(id, accession_number, assigned_to, description, exam_type, status)"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data, error } = await query;

  if (error) throw error;
  if (!data || data.length === 0) return [];
  return (data as any[]).map((p) => patientRowToPatient(p, role, userId));
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export function PatientWorklist({ selectedId, selectedStudyId, onSelect, onDelete, refreshKey = 0 }: Props) {
  const { user, role } = useAuth();
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDoctor = role === "doctor" || role === "radiologist";
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const handleDeletePatient = async (target: Patient) => {
    try {
      setIsDeleting(true);
      const authHeader = await getAuthHeader();
      const res = await fetch("/api/patients/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({ patientId: target.id }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete patient");
      }

      toast.success("Patient deleted", {
        description: `${formatPatientName(target)} (MRN: ${target.mrn})`,
      });

      setPatients((prev) => prev.filter((p) => p.id !== target.id));
      onDelete?.(target.id);
      setPatientToDelete(null);
      await load();
    } catch (err: any) {
      console.error("[PatientWorklist] delete error:", err);
      toast.error("Deletion failed", { description: err?.message || String(err) });
    } finally {
      setIsDeleting(false);
    }
  };

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setFetchError(null);

      if (isDoctor) {
        const result = await fetchDoctorWorklist(user.id);
        setPatients(result.patients);
        setDebugInfo(result.debugInfo);
        console.info("[PatientWorklist] doctor fetch:", result.debugInfo);
      } else {
        const mapped = await fetchSonographerWorklist(role, user.id);
        if (mapped.length === 0 && demoDataEnabled) {
          setPatients(mockPatients);
        } else {
          setPatients(mapped);
        }
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const debug = (err as any)?.debugInfo ?? null;
      console.error("[PatientWorklist] load error:", msg, debug);
      setFetchError(msg);
      if (debug) setDebugInfo(debug);
      if (!isDoctor && demoDataEnabled) {
        setPatients(mockPatients);
      }
    } finally {
      setLoading(false);
    }
  }, [user, role, isDoctor]);

  // Initial load + whenever refreshKey / role / user changes
  useEffect(() => {
    let active = true;
    if (!active) return;
    load();
    return () => { active = false; };
  }, [refreshKey, load]);

  // -----------------------------------------------------------------
  // Doctor-only: Supabase Realtime subscription + 30-second polling
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!isDoctor || !user?.id) return;

    const interval = setInterval(load, 30_000);

    const channel = supabase
      .channel(`doctor-studies-${user.id}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "studies", filter: `assigned_to=eq.${user.id}` },
        () => { load(); }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.info("[PatientWorklist] Realtime subscribed to doctor studies");
        }
      });

    channelRef.current = channel;

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [isDoctor, user?.id, load]);

  const filtered = patients.filter((p) =>
    `${p.firstName} ${p.lastName} ${p.mrn} ${p.accessionNumber ?? ""} ${p.exam}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  const worklistLabel = isDoctor ? "My Assigned Cases" : "Worklist";

  return (
    <aside className="flex h-full flex-col bg-card">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">{worklistLabel}</h2>
            <p className="text-xs text-muted-foreground">
              {patients.length} {isDoctor ? "assigned" : "scheduled"} {loading && "· syncing…"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={load}
            disabled={loading}
            title="Refresh worklist"
            aria-label="Refresh worklist"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search worklist"
            placeholder="Search name, MRN or accession…"
            className="pl-8 h-9"
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {/* Error state — shows the actual DB error so the issue is visible */}
        {fetchError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-destructive">Worklist fetch failed</p>
                <p className="text-[10px] text-destructive/80 mt-0.5 break-all">{fetchError}</p>
                {debugInfo && (
                  <p className="text-[10px] text-muted-foreground mt-1 break-all font-mono">{debugInfo}</p>
                )}
                <Button variant="outline" size="sm" className="mt-2 h-6 text-xs" onClick={load}>
                  Retry
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading && filtered.length === 0 && !fetchError && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}

        {!loading && !fetchError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            {isDoctor ? (
              <Stethoscope className="h-8 w-8 text-muted-foreground/30 mb-2" />
            ) : (
              <User className="h-8 w-8 text-muted-foreground/30 mb-2" />
            )}
            <p className="text-sm font-medium text-muted-foreground">
              {q.trim() ? "No matching cases" : isDoctor ? "No cases assigned" : "No patients found"}
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-[180px] mt-1">
              {q.trim() ? "Try adjusting your search terms" : isDoctor
                ? "Ask the sonographer to use 'Send to Doctor' to assign cases"
                : q
                ? "Try adjusting your search terms"
                : "Register a patient to see them in your worklist"}
            </p>
            {isDoctor && debugInfo && (
              <p className="text-[10px] text-muted-foreground/50 font-mono mt-3 max-w-[200px] break-all">
                {debugInfo}
              </p>
            )}
          </div>
        )}

        {filtered.map((p) => {
          // Use studyId as the card key (unique per study), but track selection by patient id
          const isActive = selectedStudyId ? p.studyId === selectedStudyId : p.id === selectedId;
          return (
            <Card
              key={p.studyId ?? p.id}
              onClick={() => onSelect(p)}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(p); } }}
              className={cn(
                "group relative cursor-pointer p-3 transition-all hover:shadow-sm",
                isActive
                  ? "border-2 border-primary bg-primary/5 shadow-sm"
                  : "border border-border hover:border-muted-foreground/30"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {formatPatientName(p)}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      DOB {p.dob} · {p.mrn}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {p.exam}
                      </Badge>
                      {p.studyStatus && (
                        <Badge
                          variant={p.studyStatus === "review_pending" ? "default" : "outline"}
                          className="text-[10px] font-medium"
                        >
                          {p.studyStatus.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPatientToDelete(p);
                  }}
                  title={`Delete ${p.firstName || ""} ${p.lastName || ""}`.trim()}
                  aria-label={`Delete ${p.firstName || ""} ${p.lastName || ""}`.trim()}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!patientToDelete} onOpenChange={(open) => !open && !isDeleting && setPatientToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient Record</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-foreground">
                    {formatPatientName(patientToDelete)}
                  </span>{" "}
                  (MRN: <span className="font-mono">{patientToDelete?.mrn}</span>)?
                </p>
                <p className="text-xs text-destructive/90 bg-destructive/10 p-2 rounded border border-destructive/20">
                  This will permanently remove the patient and all associated studies and worksheets from the clinic. This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                if (patientToDelete) handleDeletePatient(patientToDelete);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete Patient"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
