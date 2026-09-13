import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatBackupTimestamp,
  hasRecoverableProgress,
  getBackupStorageKey,
  type SessionBackup,
} from "../src/lib/auto-recovery";

test("formatBackupTimestamp formats absolute and relative time accurately", () => {
  const now = Date.now();
  const justNow = formatBackupTimestamp(now - 1000);
  assert.ok(justNow.absolute.includes(":"), "Should include formatted clock string");
  assert.equal(justNow.relative, "1s ago");

  const tenMinutesAgo = formatBackupTimestamp(now - 10 * 60 * 1000);
  assert.equal(tenMinutesAgo.relative, "10m ago");

  const noRecord = formatBackupTimestamp(null);
  assert.equal(noRecord.relative, "Never");
  assert.equal(noRecord.absolute, "No backup recorded");
});

test("hasRecoverableProgress detects uncommitted dirty state or findings", () => {
  const cleanBackup: SessionBackup = {
    backupId: "test-1",
    savedAt: 100000,
    savedAtIso: "2026-09-13T10:00:00.000Z",
    patientId: "patient-1",
    exam: "Abdomen",
    worksheetPayload: {
      abdomen: {},
      thyroid: {},
      ob: {},
      vascular: {},
      additionalNotes: "",
    },
    editedReportText: null,
    additionalNotes: "",
    keyImages: [],
    isDirty: false,
    source: "auto",
  };

  assert.equal(hasRecoverableProgress(null), false);
  assert.equal(hasRecoverableProgress(cleanBackup), false);

  // Marked dirty
  assert.equal(hasRecoverableProgress({ ...cleanBackup, isDirty: true }), true);

  // Has doctor report edits
  assert.equal(hasRecoverableProgress({ ...cleanBackup, editedReportText: "Gallbladder wall thickened." }), true);

  // Has doctor notes
  assert.equal(hasRecoverableProgress({ ...cleanBackup, additionalNotes: "Follow-up recommended in 6 months." }), true);

  // Timestamp is significantly newer than server record
  const serverTimeIso = "2026-09-13T10:00:00.000Z";
  const serverTimeMs = new Date(serverTimeIso).getTime();
  const newerBackup: SessionBackup = {
    ...cleanBackup,
    savedAt: serverTimeMs + 10000, // 10s newer than server
  };
  assert.equal(hasRecoverableProgress(newerBackup, serverTimeIso), true);

  const olderBackup: SessionBackup = {
    ...cleanBackup,
    savedAt: serverTimeMs - 5000, // 5s older than server
  };
  assert.equal(hasRecoverableProgress(olderBackup, serverTimeIso), false);
});

test("getBackupStorageKey generates isolated keys per patient", () => {
  assert.equal(getBackupStorageKey("pt-123"), "sonolynx_crashproof_backup_pt-123");
  assert.equal(getBackupStorageKey("pt-456"), "sonolynx_crashproof_backup_pt-456");
  assert.notEqual(getBackupStorageKey("pt-123"), getBackupStorageKey("pt-456"));
});
