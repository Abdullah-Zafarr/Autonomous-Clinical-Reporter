import { supabase } from "@/integrations/supabase/client";
import { ApiError, postJson } from "@/lib/api-client";

const db = supabase as any;

export type Hl7Status = "pending" | "sent" | "failed";

export interface Hl7TransmitParams {
  organizationId?: string | null;
  patientId: string;
  studyId: string;
  worksheetId: string;
  accessionNumber: string;
  payload: string;
  userId: string;
}

/** Columns we added via migration — PostgREST may not know about them yet if the
 *  schema cache hasn't been refreshed. We detect the error and retry without them. */
const NEW_HL7_COLUMNS = new Set(["organization_id", "patient_id", "endpoint_url", "sent_by"]);

function isSchemaCacheError(error: any, column?: string): boolean {
  if (!error) return false;
  const isKnownCode = error.code === "PGRST204" || error.code === "42703";
  if (!isKnownCode) return false;
  if (!column) return true;
  const msg = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return msg.includes(column.toLowerCase());
}

export async function createPendingHl7Message(params: Hl7TransmitParams) {
  if (!params.organizationId) throw new Error("Clinic membership is required to send a report.");
  const endpointUrl = process.env.NEXT_PUBLIC_HL7_EXPORT_API_URL || "";

  const fullPayload: Record<string, unknown> = {
    organization_id: params.organizationId ?? null,
    patient_id: params.patientId,
    study_id: params.studyId,
    worksheet_id: params.worksheetId,
    message_type: "ORU^R01",
    payload: params.payload,
    endpoint_url: endpointUrl || null,
    status: "pending",
    sent_by: params.userId,
  };

  let { data, error } = await db
    .from("hl7_messages")
    .insert(fullPayload)
    .select("*")
    .single();

  // If PostgREST schema cache doesn't know about our new columns yet, retry
  // with only the original columns that were present at table creation.
  if (error && isSchemaCacheError(error)) {
    const stripped: Record<string, unknown> = {
      organization_id: params.organizationId,
      study_id: params.studyId,
      worksheet_id: params.worksheetId,
      message_type: "ORU^R01",
      payload: params.payload,
      status: "pending",
    };

    // Identify which NEW_HL7_COLUMNS caused the error and log it
    const badCol = [...NEW_HL7_COLUMNS].find((c) =>
      `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase().includes(c)
    );
    console.warn(
      `[hl7-service] Schema cache missing column '${badCol ?? "unknown"}'. ` +
      "Retrying with minimal payload. Run: Supabase Dashboard → API → Reload schema."
    );

    const retry = await db
      .from("hl7_messages")
      .insert(stripped)
      .select("*")
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return data as { id: string };
}


export async function updateHl7Message(
  messageId: string,
  patch: {
    status: Hl7Status;
    response_body?: string | null;
    error_message?: string | null;
    sent_at?: string | null;
  },
) {
  const { data, error } = await db.from("hl7_messages").update(patch).eq("id", messageId).select("*").single();
  if (error) throw error;
  return data;
}

export async function transmitHl7(params: Hl7TransmitParams) {
  const externalUrl = process.env.NEXT_PUBLIC_HL7_EXPORT_API_URL;
  const localUrl = "/api/hl7/transmit";
  const pending = await createPendingHl7Message(params);

  const payload = {
    messageType: "ORU_R01",
    patientId: params.patientId,
    studyId: params.studyId,
    accessionNumber: params.accessionNumber,
    payload: params.payload,
  };

  // Try external first if configured
  if (externalUrl) {
    try {
      const response = await postJson<unknown>(
        externalUrl,
        payload,
        { timeoutMs: 10000, retries: 0 },
      );

      await updateHl7Message(pending.id, {
        status: "sent",
        response_body: JSON.stringify(response ?? {}),
        sent_at: new Date().toISOString(),
      });
      return { ok: true, messageId: pending.id, demo: false };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "HL7 gateway failed.";
      await updateHl7Message(pending.id, { status: "failed", error_message: errorMessage });
      return { ok: false, messageId: pending.id, errorMessage, demo: false };
    }
  }

  // Fallback to local mock
  try {
    const response = await postJson<unknown>(
      localUrl,
      payload,
      { timeoutMs: 5000, retries: 0 },
    );

    await updateHl7Message(pending.id, {
      status: "sent",
      response_body: JSON.stringify(response ?? { mock: true }),
      sent_at: new Date().toISOString(),
    });
    return { ok: true, messageId: pending.id, demo: true };
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    const errorMessage = error instanceof Error ? error.message : "HL7 export failed.";
    await updateHl7Message(pending.id, {
      status: "failed",
      error_message: errorMessage,
      response_body: apiError?.responseBody ?? null,
    });
    return {
      ok: false,
      messageId: pending.id,
      errorMessage,
      demo: false,
    };
  }
}
