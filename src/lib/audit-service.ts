import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface AuditLogEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  patient_id: string | null;
  study_id: string | null;
  worksheet_id: string | null;
  hl7_message_id: string | null;
  action: string;
  status: string;
  staffName: string;
  staffEmail: string;
  staffRole: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface WriteAuditLogParams {
  userId?: string | null;
  patientId?: string | null;
  studyId?: string | null;
  worksheetId?: string | null;
  hl7MessageId?: string | null;
  action: string;
  status: string;
  staffName?: string | null;
  staffEmail?: string | null;
  staffRole?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

const LOCAL_AUDIT_PREFIX = "sonolynx_audit_log_";

function getLocalAuditKey(patientId?: string | null, studyId?: string | null): string {
  const key = studyId || patientId || "global";
  return `${LOCAL_AUDIT_PREFIX}${key}`;
}

export function getLocalAuditEntries(patientId?: string | null, studyId?: string | null): AuditLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getLocalAuditKey(patientId, studyId));
    if (!raw) return [];
    return JSON.parse(raw) as AuditLogEntry[];
  } catch (err) {
    console.warn("[audit-service] Failed reading local audit entries:", err);
    return [];
  }
}

export function saveLocalAuditEntry(entry: AuditLogEntry): void {
  if (typeof window === "undefined") return;
  try {
    const key = getLocalAuditKey(entry.patient_id, entry.study_id);
    const existing = getLocalAuditEntries(entry.patient_id, entry.study_id);
    // Deduplicate and keep newest first up to 100 entries
    const filtered = existing.filter((e) => e.id !== entry.id);
    filtered.unshift(entry);
    const trimmed = filtered.slice(0, 100);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("[audit-service] Failed writing local audit entry:", err);
  }
}

export function formatAuditActionDescription(action: string, metadata?: Record<string, unknown>): string {
  switch (action) {
    case "sign_send_hl7":
    case "report_signed":
      return `Digitally signed and finalized clinical report. ${metadata?.accession ? `Accession: ${metadata.accession}. ` : ""}Permanent legal record locked.`;
    case "worksheet_save_draft":
      return `Saved draft worksheet with ${metadata?.worksheetType || "ultrasound"} findings and measurements.`;
    case "send_to_doctor":
      return `Assigned study to ${metadata?.doctorEmail || "physician"} for formal clinical review.`;
    case "return_for_correction":
      return `Returned study to sonographer for field revisions (${metadata?.openCorrections ?? "open"} correction requests).`;
    case "image_annotated_attached":
    case "image_attached":
      return `Attached ultrasound picture with direct red clinical markup to patient report.`;
    case "report_text_edited":
      return `Clinical narrative impressions and report text modified by clinician.`;
    case "session_backup":
      return `Crash-proof auto-recovery snapshot saved to resilient local storage.`;
    case "session_restored":
      return `Restored uncommitted session findings and custom text after unexpected exit.`;
    case "case_opened":
      return `Ultrasound patient examination opened in clinical workspace.`;
    default:
      return (metadata?.description as string) || `Recorded clinical action: ${action.replace(/_/g, " ")}.`;
  }
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<AuditLogEntry> {
  const now = new Date();
  const id = crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const staffName = params.staffName || (params.metadata?.staffName as string) || (params.staffEmail ? params.staffEmail.split("@")[0] : "Clinic Clinician");
  const staffEmail = params.staffEmail || (params.metadata?.staffEmail as string) || (params.userId ? `${params.userId.slice(0, 8)}@clinic.org` : "staff@clinic.org");
  const staffRole = params.staffRole || (params.metadata?.staffRole as string) || "Clinician";
  const description = params.description || formatAuditActionDescription(params.action, params.metadata);

  const enrichedMetadata: Record<string, unknown> = {
    ...(params.metadata ?? {}),
    staffName,
    staffEmail,
    staffRole,
    description,
    timestamp: now.toISOString(),
  };

  const entry: AuditLogEntry = {
    id,
    created_at: now.toISOString(),
    user_id: params.userId ?? null,
    patient_id: params.patientId ?? null,
    study_id: params.studyId ?? null,
    worksheet_id: params.worksheetId ?? null,
    hl7_message_id: params.hl7MessageId ?? null,
    action: params.action,
    status: params.status,
    staffName,
    staffEmail,
    staffRole,
    description,
    metadata: enrichedMetadata,
  };

  // 1. Immediately save to persistent local audit trail for zero-latency & offline legal protection
  saveLocalAuditEntry(entry);

  // 2. Persist to Supabase audit_logs table
  try {
    const { error } = await db.from("audit_logs").insert({
      id: entry.id,
      user_id: entry.user_id,
      patient_id: entry.patient_id,
      study_id: entry.study_id,
      worksheet_id: entry.worksheet_id,
      hl7_message_id: entry.hl7_message_id,
      action: entry.action,
      status: entry.status,
      metadata: entry.metadata as Json,
    });

    if (error) {
      console.warn("[Sonolynx] Remote audit log write notice:", error);
    }
  } catch (err) {
    console.warn("[Sonolynx] Remote audit log write failed (retained in local audit trail):", err);
  }

  return entry;
}

export async function getAuditLogsForCase(params: {
  patientId?: string | null;
  studyId?: string | null;
}): Promise<AuditLogEntry[]> {
  const localLogs = getLocalAuditEntries(params.patientId, params.studyId);

  try {
    let query = db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50);

    if (params.studyId && params.patientId) {
      query = query.or(`study_id.eq.${params.studyId},patient_id.eq.${params.patientId}`);
    } else if (params.studyId) {
      query = query.eq("study_id", params.studyId);
    } else if (params.patientId) {
      query = query.eq("patient_id", params.patientId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[audit-service] Supabase query notice:", error);
      return localLogs;
    }

    const remoteLogs: AuditLogEntry[] = (data || []).map((row: any) => {
      const meta = (row.metadata || {}) as Record<string, any>;
      return {
        id: row.id,
        created_at: row.created_at,
        user_id: row.user_id,
        patient_id: row.patient_id,
        study_id: row.study_id,
        worksheet_id: row.worksheet_id,
        hl7_message_id: row.hl7_message_id,
        action: row.action,
        status: row.status,
        staffName: meta.staffName || (meta.staffEmail ? meta.staffEmail.split("@")[0] : "Clinic Clinician"),
        staffEmail: meta.staffEmail || "staff@clinic.org",
        staffRole: meta.staffRole || "Clinician",
        description: meta.description || formatAuditActionDescription(row.action, meta),
        metadata: meta,
      };
    });

    // Merge remote and local logs, deduping by ID
    const map = new Map<string, AuditLogEntry>();
    remoteLogs.forEach((l) => map.set(l.id, l));
    localLogs.forEach((l) => {
      if (!map.has(l.id)) {
        map.set(l.id, l);
      }
    });

    const combined = Array.from(map.values());
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return combined;
  } catch (err) {
    console.warn("[audit-service] Error fetching remote audit logs:", err);
    return localLogs;
  }
}

/**
 * Exports audit entries to CSV format for HIPAA / compliance audits.
 */
export function exportAuditLogsToCsv(logs: AuditLogEntry[], patientName: string = "Patient"): void {
  if (typeof window === "undefined" || !logs.length) return;

  const headers = ["Timestamp (UTC)", "Timestamp (Local)", "Action", "Status", "Staff Name", "Staff Email", "Staff Role", "Description", "Patient ID", "Study ID"];
  const rows = logs.map((log) => {
    const localDate = new Date(log.created_at).toLocaleString();
    return [
      `"${log.created_at}"`,
      `"${localDate}"`,
      `"${log.action}"`,
      `"${log.status}"`,
      `"${log.staffName.replace(/"/g, '""')}"`,
      `"${log.staffEmail.replace(/"/g, '""')}"`,
      `"${log.staffRole.replace(/"/g, '""')}"`,
      `"${log.description.replace(/"/g, '""')}"`,
      `"${log.patient_id || ""}"`,
      `"${log.study_id || ""}"`,
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Audit_Trail_${patientName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
