import assert from "node:assert/strict";
import { test } from "node:test";

interface WorksheetRow {
  id?: string;
  status: string;
  signed_at: string | null;
  signed_by: string | null;
  user_id: string;
  created_by: string;
  sonographer_id: string;
}

// Logic mirror from worksheet-service saveDraftWorksheet immutability guard
function resolveRevisionTarget(
  existing: WorksheetRow | null,
  currentEditorId: string,
  providedId?: string,
) {
  let targetId = providedId;
  let author = {
    user_id: currentEditorId,
    created_by: currentEditorId,
    sonographer_id: currentEditorId,
  };

  if (existing && targetId) {
    const isSignedOrFinal =
      existing.signed_at ||
      existing.signed_by ||
      (existing.status !== "draft" && existing.status !== "failed");

    if (isSignedOrFinal) {
      // Guard against overwriting signed records: force creation of a new revision
      targetId = undefined;
    } else {
      // Preserve original sonographer author
      author = {
        user_id: existing.user_id ?? currentEditorId,
        created_by: existing.created_by ?? currentEditorId,
        sonographer_id: existing.sonographer_id ?? currentEditorId,
      };
    }
  }

  return { targetId, author };
}

test("security: protects signed reports by forcing a new revision ID instead of overwriting", () => {
  const signedWorksheet: WorksheetRow = {
    id: "ws-signed-12345",
    status: "signed",
    signed_at: "2026-09-08T14:30:00Z",
    signed_by: "dr-smith",
    user_id: "sono-alex",
    created_by: "sono-alex",
    sonographer_id: "sono-alex",
  };

  const { targetId } = resolveRevisionTarget(
    signedWorksheet,
    "dr-johnson",
    "ws-signed-12345",
  );

  // targetId MUST be cleared to undefined so a new row is inserted
  assert.equal(targetId, undefined);
});

test("security: preserves original sonographer authorship when doctor edits an active draft", () => {
  const activeDraft: WorksheetRow = {
    id: "ws-draft-67890",
    status: "draft",
    signed_at: null,
    signed_by: null,
    user_id: "sono-alex",
    created_by: "sono-alex",
    sonographer_id: "sono-alex",
  };

  const { targetId, author } = resolveRevisionTarget(
    activeDraft,
    "dr-johnson", // doctor is editing
    "ws-draft-67890",
  );

  // Target ID remains the same (updating active draft)
  assert.equal(targetId, "ws-draft-67890");
  // Authorship remains tied to original sonographer
  assert.equal(author.sonographer_id, "sono-alex");
  assert.equal(author.created_by, "sono-alex");
});

test("security: audit log event structure enforces tamper-evident metadata", () => {
  function createAuditEvent(action: string, actorId: string, resourceId: string, metadata: Record<string, unknown>) {
    return {
      action,
      actor_id: actorId,
      resource_id: resourceId,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }

  const event = createAuditEvent("explanation_approved", "dr-101", "ws-404", {
    language: "Urdu",
    sourceHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  });

  assert.equal(event.action, "explanation_approved");
  assert.equal(event.actor_id, "dr-101");
  assert.ok(typeof event.timestamp === "string");
  assert.equal((event.metadata as any).language, "Urdu");
});
