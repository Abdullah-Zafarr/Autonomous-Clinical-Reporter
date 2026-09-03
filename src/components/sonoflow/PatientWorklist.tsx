import { Search, User, Loader2, Stethoscope, AlertTriangle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Patient } from "@/lib/sonoflow-types";
import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserOrganizationId } from "@/lib/org-scope";
import { mockPatients } from "@/lib/sonoflow-types";
import { useAuth } from "@/lib/auth-context";

interface Props {
  selectedId: string;
  onSelect: (p: Patient) => void;
  refreshKey?: number;
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
  // Step 1: query all studies assigned to this doctor (no status filter — we want
  // to see everything the sonographer sent, even if status didn't get updated).
  const { data, error } = await (supabase as any)
    .from("studies")
    .select(
      "id, accession_number, assigned_to, description, exam_type, status, patient_id, study_date," +
        "patients:patient_id(id, mrn, first_name, last_name, dob)"
    )
    .eq("assigned_to", userId)
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

  let query = (supabase as any)
    .from("patients")
    .select(
      "id, mrn, first_name, last_name, dob, studies(id, accession_number, assigned_to, description, exam_type, status)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (organizationId) {
    query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
  }

  let { data, error } = await query;

  // Backwards-compat: retry without org filter if column is missing
  if (
    error &&
    (error.code === "42703" || error.code === "PGRST204") &&
    `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase().includes("organization_id")
  ) {
    const retry = await (supabase as any)
      .from("patients")
      .select(
        "id, mrn, first_name, last_name, dob, studies(id, accession_number, assigned_to, description, exam_type, status)"
      )
      .order("created_at", { ascending: false })
      .limit(50);
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  if (!data || data.length === 0) return [];
  return (data as any[]).map((p) => patientRowToPatient(p, role, userId));
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export function PatientWorklist({ selectedId, onSelect, refreshKey = 0 }: Props) {
  const { user, role } = useAuth();
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const isDoctor = role === "doctor" || role === "radiologist";
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
        if (mapped.length === 0 && process.env.NODE_ENV === "development") {
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
      if (!isDoctor && process.env.NODE_ENV === "development") {
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
    `${p.firstName} ${p.lastName} ${p.mrn}`.toLowerCase().includes(q.toLowerCase())
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
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or MRN…"
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
              {isDoctor ? "No cases assigned" : "No patients found"}
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-[180px] mt-1">
              {isDoctor
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
          const isActive = p.id === selectedId;
          return (
            <Card
              key={p.studyId ?? p.id}
              onClick={() => onSelect(p)}
              className={cn(
                "cursor-pointer p-3 transition-all hover:shadow-sm",
                isActive
                  ? "border-2 border-primary bg-primary/5 shadow-sm"
                  : "border border-border"
              )}
            >
              <div className="flex items-start gap-3">
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
                    {p.lastName || "—"}, {p.firstName || "—"}
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
            </Card>
          );
        })}
      </div>
    </aside>
  );
}
