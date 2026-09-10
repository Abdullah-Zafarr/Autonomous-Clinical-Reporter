import assert from "node:assert/strict";
import { test } from "node:test";
import { worksheetFieldOptions } from "../src/lib/clinical-workflow-types";
import { workflowProgress } from "../src/lib/workflow-progress";
import { mockAbdomenWithFindings } from "./fixtures/test-data";

test("correction workflow: accurately maps nested abdominal worksheet fields for doctor review", () => {
  const fields = worksheetFieldOptions(mockAbdomenWithFindings, "abdomen");
  const paths = fields.map((f) => f.path);

  // Checks that doctor can target specific organs
  assert.ok(paths.includes("abdomen.liver.size"));
  assert.ok(paths.includes("abdomen.gallbladder.wallThickness"));
  assert.ok(paths.includes("abdomen.pancreas.duct"));
  assert.ok(paths.includes("abdomen.rightKidney.length"));

  // Check extracted values
  const liverSizeField = fields.find((f) => f.path === "abdomen.liver.size");
  assert.equal(liverSizeField?.value, "14.5");
});

test("correction workflow: locks case in Review phase with correction_requested status", () => {
  // Case with active correction requested by doctor
  const progress = workflowProgress({
    studyStatus: "correction_requested",
    worksheet: {
      status: "draft",
      created_at: "2026-09-08T10:00:00Z",
      signed_at: null,
      signed_by: null,
    },
    reviewAt: "2026-09-08T10:30:00Z",
    delivery: null,
  });

  assert.equal(progress.summary, "Correction requested");
  assert.equal(progress.steps[1].detail, "Returned for correction");
  assert.equal(progress.steps[1].complete, false); // Not finalized
  assert.equal(progress.steps[2].complete, false); // Signature locked
});

test("correction workflow: prevents signed progression until corrections are resolved", () => {
  const progress = workflowProgress({
    studyStatus: "correction_requested",
    worksheet: {
      status: "draft",
      created_at: "2026-09-08T10:00:00Z",
      signed_at: null,
      signed_by: null,
    },
    reviewAt: null,
    delivery: null,
  });

  assert.equal(progress.active, 1); // Stays in review index
  assert.equal(progress.steps[2].complete, false);
  assert.equal(progress.steps[3].complete, false);
});
