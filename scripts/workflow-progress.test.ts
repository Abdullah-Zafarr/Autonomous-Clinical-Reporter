import assert from "node:assert/strict";
import { test } from "node:test";
import { workflowProgress, type WorkflowSnapshot } from "../src/lib/workflow-progress";

const base: WorkflowSnapshot = {
  studyStatus: "scheduled",
  worksheet: null,
  reviewAt: null,
  delivery: null,
};
const draft = {
  status: "draft",
  created_at: "2026-09-06T09:00:00Z",
  signed_at: null,
  signed_by: null,
};
const signed = {
  ...draft,
  status: "signed",
  signed_at: "2026-09-06T10:00:00Z",
  signed_by: "clinician",
};
test("unsaved and saved drafts stay in the worksheet stage", () => {
  assert.equal(workflowProgress(base).summary, "Worksheet not started");
  assert.equal(workflowProgress({ ...base, worksheet: draft }).summary, "Worksheet in progress");
});
test("submission activates review without claiming signature", () => {
  const progress = workflowProgress({ ...base, worksheet: draft, studyStatus: "review_pending" });
  assert.equal(progress.active, 1);
  assert.equal(progress.steps[0].complete, true);
  assert.equal(progress.steps[2].complete, false);
  assert.equal(progress.steps[1].time, null);
});
test("returned cases remain in review and show correction status", () => {
  const progress = workflowProgress({ ...base, worksheet: draft, studyStatus: "correction_requested" });
  assert.equal(progress.active, 1);
  assert.equal(progress.summary, "Correction requested");
  assert.equal(progress.steps[1].detail, "Returned for correction");
  assert.equal(progress.steps[2].complete, false);
});
test("completed study does not imply delivery or signing a new draft", () => {
  assert.equal(workflowProgress({ ...base, studyStatus: "completed", worksheet: draft }).active, 0);
  assert.equal(
    workflowProgress({ ...base, studyStatus: "completed", worksheet: signed }).active,
    3,
  );
});
test("failed delivery preserves signed progress", () => {
  const progress = workflowProgress({ ...base, worksheet: signed, delivery: { status: "failed" } });
  assert.equal(progress.summary, "Delivery failed");
  assert.ok(progress.steps[2].complete);
  assert.equal(progress.steps[3].complete, false);
});
test("demo acknowledgments are distinguished from real delivery", () => {
  const progress = workflowProgress({
    ...base,
    worksheet: signed,
    delivery: { status: "sent", response_body: '{"messageId":"MOCK-123"}' },
  });
  assert.equal(progress.summary, "Demo sent");
  assert.equal(progress.steps[3].detail, "Demo receiver only");
  assert.equal(
    workflowProgress({
      ...base,
      worksheet: signed,
      delivery: { status: "sent", response_body: "ACK" },
    }).summary,
    "Sent",
  );
});
test("old delivery does not mark an unsigned draft sent", () => {
  assert.equal(
    workflowProgress({ ...base, worksheet: draft, delivery: { status: "sent" } }).steps[3].complete,
    false,
  );
});
