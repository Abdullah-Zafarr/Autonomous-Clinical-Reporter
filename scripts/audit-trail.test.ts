process.env.NEXT_PUBLIC_SUPABASE_URL = "https://review.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-test-key";

import assert from "node:assert/strict";
import { test } from "node:test";

const { formatAuditActionDescription } = await import("../src/lib/audit-service");
import type { AuditLogEntry } from "../src/lib/audit-service";

test("formatAuditActionDescription formats human-readable legal descriptions", () => {
  const signDesc = formatAuditActionDescription("sign_send_hl7", { accession: "ACC-998811" });
  assert.ok(signDesc.includes("Digitally signed"), "Should mention digital signature");
  assert.ok(signDesc.includes("ACC-998811"), "Should include accession number");

  const draftDesc = formatAuditActionDescription("worksheet_save_draft", { worksheetType: "Thyroid" });
  assert.ok(draftDesc.includes("Thyroid"), "Should include exam type");
  assert.ok(draftDesc.includes("Saved draft worksheet"), "Should describe draft save");

  const doctorDesc = formatAuditActionDescription("send_to_doctor", { doctorEmail: "dr.smith@clinic.org" });
  assert.ok(doctorDesc.includes("dr.smith@clinic.org"), "Should include physician email");

  const correctionDesc = formatAuditActionDescription("return_for_correction", { openCorrections: 2 });
  assert.ok(correctionDesc.includes("2"), "Should include correction count");

  const imageDesc = formatAuditActionDescription("image_annotated_attached");
  assert.ok(imageDesc.includes("red clinical markup"), "Should mention red markup");
});

test("AuditLogEntry structure enforces staff names, timestamps, and accountability fields", () => {
  const sampleEntry: AuditLogEntry = {
    id: "audit-123",
    created_at: "2026-09-13T12:00:00.000Z",
    user_id: "user-456",
    patient_id: "pt-789",
    study_id: "study-101",
    worksheet_id: "ws-202",
    hl7_message_id: null,
    action: "report_signed",
    status: "signed",
    staffName: "Dr. Alexander Wright",
    staffEmail: "alexander.wright@hospital.org",
    staffRole: "Doctor / Radiologist",
    description: "Digitally signed and finalized clinical report.",
    metadata: {
      accession: "ACC-789001",
      patientName: "Jane Doe",
    },
  };

  assert.equal(sampleEntry.staffName, "Dr. Alexander Wright");
  assert.equal(sampleEntry.staffRole, "Doctor / Radiologist");
  assert.equal(sampleEntry.action, "report_signed");
  assert.ok(sampleEntry.created_at.includes("2026-09-13"));
});
