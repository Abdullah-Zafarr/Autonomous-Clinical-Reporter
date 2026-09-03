import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { ExamType } from "@/lib/sonoflow-types";

export type WorksheetStatus = "draft" | "signed" | "transmitted" | "failed";

export interface WorksheetPayload {
  abdomen: unknown;
  abdomenOrder?: string[];
  thyroid: unknown;
  ob: unknown;
  vascular: unknown;
  additionalNotes: string;
}

export interface WorksheetRecord {
  id: string;
  patient_id: string;
  study_id: string;
  user_id: string | null;
  created_by: string | null;
  organization_id?: string | null;
  sonographer_id?: string | null;
  worksheet_type: ExamType;
  status: WorksheetStatus;
  data: WorksheetPayload;
  form_data?: any;
  report_text: string | null;
  signed_by: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

const db = supabase as any;
const toJsonPayload = (payload: WorksheetPayload) => payload as unknown as Json;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasKeys = (value: unknown) => isObject(value) && Object.keys(value).length > 0;

const hasWorksheetPayloadShape = (value: unknown) =>
  isObject(value) &&
  ("abdomen" in value ||
    "abdomenOrder" in value ||
    "thyroid" in value ||
    "ob" in value ||
    "vascular" in value ||
    "additionalNotes" in value);

const normalizePayload = (value: unknown, worksheetType: ExamType): WorksheetPayload => {
  if (hasWorksheetPayloadShape(value)) {
    const payload = value as Partial<WorksheetPayload>;
    return {
      abdomen: payload.abdomen ?? {},
      abdomenOrder: Array.isArray(payload.abdomenOrder) ? payload.abdomenOrder : [],
      thyroid: payload.thyroid ?? {},
      ob: payload.ob ?? {},
      vascular: payload.vascular ?? {},
      additionalNotes: typeof payload.additionalNotes === "string" ? payload.additionalNotes : "",
    };
  }

  const legacySection = hasKeys(value) ? value : {};
  return {
    abdomen: worksheetType === "Abdomen" ? legacySection : {},
    abdomenOrder: [],
    thyroid: worksheetType === "Thyroid" ? legacySection : {},
    ob: worksheetType === "OB" ? legacySection : {},
    vascular: worksheetType === "Vascular" ? legacySection : {},
    additionalNotes: "",
  };
};

const normalizeWorksheetRecord = (record: any): WorksheetRecord | null => {
  if (!record) return null;
  const rawPayload = hasKeys(record.data) ? record.data : record.form_data;
  return {
    ...record,
    data: normalizePayload(rawPayload, (record.worksheet_type ?? "Abdomen") as ExamType),
  } as WorksheetRecord;
};

const isMissingTableError = (error: any) => {
  if (!error) return false;
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
};

const isMissingColumnError = (error: any, column: string) => {
  const message = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
  return (
    (error?.code === "42703" || error?.code === "PGRST204") &&
    message.includes(column.toLowerCase()) &&
    message.includes("column")
  );
};


const OPTIONAL_WORKSHEET_COLUMNS = new Set([
  "created_by",
  "data",
  "organization_id",
  "patient_id",
  "report_text",
  "signed_at",
  "signed_by",
  "user_id",
  "worksheet_type",
]);

const getMissingColumnName = (error: any) => {
  if (!(error?.code === "42703" || error?.code === "PGRST204")) return null;

  const message = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
  const qualifiedMatch = message.match(/column\s+worksheets\.([a-z0-9_]+)\s+does not exist/);
  if (qualifiedMatch?.[1]) return qualifiedMatch[1];

  const schemaCacheMatch = message.match(/'([a-z0-9_]+)'\s+column/);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  return null;
};

async function runWorksheetMutationWithSchemaFallback<T extends Record<string, unknown>>(
  initialPayload: T,
  mutate: (payload: Partial<T>) => Promise<{ data: any; error: any }>,
) {
  const payload: Partial<T> = { ...initialPayload };

  for (let attempt = 0; attempt < OPTIONAL_WORKSHEET_COLUMNS.size + 1; attempt += 1) {
    const result = await mutate(payload);
    const missingColumn = getMissingColumnName(result.error);

    if (
      missingColumn &&
      OPTIONAL_WORKSHEET_COLUMNS.has(missingColumn) &&
      Object.prototype.hasOwnProperty.call(payload, missingColumn)
    ) {
      delete (payload as Record<string, unknown>)[missingColumn];
      continue;
    }

    return result;
  }

  return mutate(payload);
}

export async function loadWorksheet(
  studyId: string,
  worksheetType?: ExamType,
  activeWorksheetId?: string | null
) {
  // 1. Most deterministic path: load the exact worksheet the sonographer pinned
  if (activeWorksheetId) {
    const { data: pinned, error: pinnedError } = await db
      .from("worksheets")
      .select("*")
      .eq("id", activeWorksheetId)
      .maybeSingle();

    // If the column or row doesn't exist, fall through to the study-based path
    if (!pinnedError && pinned) {
      console.info("[loadWorksheet] Loaded pinned active_worksheet_id:", activeWorksheetId);
      return normalizeWorksheetRecord(pinned);
    }
    if (pinnedError) {
      console.warn("[loadWorksheet] Could not load by active_worksheet_id, falling back:", pinnedError.message);
    }
  }

  // 2. Fallback: most recent worksheet for this study
  let query = db
    .from("worksheets")
    .select("*")
    .eq("study_id", studyId)
    .order("updated_at", { ascending: false })
    .limit(1);

  // Only filter by type when explicitly provided (sonographer saves by type;
  // doctors need to load whatever the sonographer saved)
  if (worksheetType) {
    query = query.eq("worksheet_type", worksheetType);
  }

  const { data, error } = await query.maybeSingle();

  if (isMissingTableError(error)) {
    return null;
  }

  if (error) throw error;
  return normalizeWorksheetRecord(data);
}

export async function saveDraftWorksheet(params: {
  worksheetId?: string | null;
  patientId: string;
  studyId: string;
  userId: string;
  worksheetType: ExamType;
  data: WorksheetPayload;
  reportText: string;
}) {
  let targetWorksheetId = params.worksheetId || undefined;

  if (targetWorksheetId) {
    const { data: existing, error: existingError } = await db
      .from("worksheets")
      .select("status")
      .eq("id", targetWorksheetId)
      .maybeSingle();

    if (!existingError && existing?.status && existing.status !== "draft" && existing.status !== "failed") {
      // If the current worksheet was already signed or transmitted, create a new draft revision
      // linked to the study instead of throwing a blocking error.
      targetWorksheetId = undefined;
    }
  }

  const { getCurrentUserOrganizationId } = await import("@/lib/org-scope");
  const organizationId = await getCurrentUserOrganizationId();

  if (!organizationId) {
    throw new Error("Organization context not found. Please ensure you are logged in correctly.");
  }

  const savedAt = new Date().toISOString();
  const row = {
    id: targetWorksheetId,
    patient_id: params.patientId,
    study_id: params.studyId,
    user_id: params.userId,
    created_by: params.userId,
    sonographer_id: params.userId,
    worksheet_type: params.worksheetType,
    organization_id: organizationId,
    report_text: params.reportText,
    status: "draft",
    form_data: toJsonPayload(params.data),
    signed_by: null,
    signed_at: null,
    updated_at: savedAt,
  };

  const { data, error } = await runWorksheetMutationWithSchemaFallback(
    { ...row, data: toJsonPayload(params.data) },
    (payload) =>
      db
        .from("worksheets")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single(),
  );

  if (isMissingColumnError(error, "data")) {
    const retry = await db
      .from("worksheets")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();
    if (retry.error) throw retry.error;
    return normalizeWorksheetRecord(retry.data) as WorksheetRecord;
  }

  if (error) throw error;
  return normalizeWorksheetRecord(data) as WorksheetRecord;
}

export async function markWorksheetSigned(params: {
  worksheetId: string;
  userId: string;
  data: WorksheetPayload;
  reportText: string;
}) {
  if (!params.worksheetId || !params.worksheetId.trim()) {
    throw new Error("Missing worksheetId for signing.");
  }

  const signedAt = new Date().toISOString();
  const updates = {
    report_text: params.reportText,
    signed_by: params.userId,
    signed_at: signedAt,
    status: "signed",
    form_data: toJsonPayload(params.data),
    updated_at: signedAt,
  };

  const { data, error } = await runWorksheetMutationWithSchemaFallback(
    { ...updates, data: toJsonPayload(params.data) },
    (payload) =>
      db
        .from("worksheets")
        .update(payload)
        .eq("id", params.worksheetId)
        .select("*")
        .single(),
  );

  if (error) throw error;
  return normalizeWorksheetRecord(data) as WorksheetRecord;
}

export async function updateWorksheetStatus(worksheetId: string, status: WorksheetStatus) {
  const { data, error } = await db
    .from("worksheets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", worksheetId)
    .select("*")
    .single();

  // Live DBs that haven't had the migration applied yet only allow 'draft'/'signed'
  // in the status CHECK constraint. If we try to set 'transmitted' or 'failed',
  // Postgres returns error code 23514 (check_violation).
  // Gracefully downgrade so the rest of the flow doesn't crash.
  if (error?.code === "23514") {
    const fallbackStatus: WorksheetStatus = status === "transmitted" ? "signed" : "draft";
    console.warn(
      `[updateWorksheetStatus] CHECK constraint rejected status='${status}'. ` +
        `Downgrading to '${fallbackStatus}'. Run the schema fix migration to allow all statuses.`
    );
    const retry = await db
      .from("worksheets")
      .update({ status: fallbackStatus, updated_at: new Date().toISOString() })
      .eq("id", worksheetId)
      .select("*")
      .single();
    if (retry.error) throw retry.error;
    return normalizeWorksheetRecord(retry.data) as WorksheetRecord;
  }

  if (error) throw error;
  return normalizeWorksheetRecord(data) as WorksheetRecord;
}


export async function getReportHistory(patientId: string) {
  const { data, error } = await db
    .from("worksheets")
    .select(`
      id,
      patient_id,
      study_id,
      worksheet_type,
      status,
      report_text,
      signed_by,
      signed_at,
      created_at,
      updated_at,
      studies:study_id (
        accession_number,
        modality,
        exam_type,
        description
      )
    `)
    .eq("patient_id", patientId)
    .in("status", ["signed", "transmitted", "failed"])
    .order("signed_at", { ascending: false, nullsFirst: false });

  if (isMissingTableError(error)) {
    return [];
  }

  if (isMissingColumnError(error, "patient_id")) {
    const { data: studies, error: studiesError } = await db
      .from("studies")
      .select("id")
      .eq("patient_id", patientId);

    if (studiesError) throw studiesError;

    const studyIds = (studies ?? []).map((study: { id: string }) => study.id);
    if (studyIds.length === 0) return [];

    const { data: fallbackData, error: fallbackError } = await db
      .from("worksheets")
      .select(`
        id,
        study_id,
        worksheet_type,
        status,
        report_text,
        signed_by,
        signed_at,
        created_at,
        updated_at,
        studies:study_id (
          accession_number,
          modality,
          exam_type,
          description
        )
      `)
      .in("study_id", studyIds)
      .in("status", ["signed", "transmitted", "failed"])
      .order("signed_at", { ascending: false, nullsFirst: false });

    if (fallbackError) throw fallbackError;
    return (fallbackData ?? []) as Array<WorksheetRecord & { studies?: any }>;
  }

  if (error) throw error;
  return (data ?? []) as Array<WorksheetRecord & { studies?: any }>;
}
