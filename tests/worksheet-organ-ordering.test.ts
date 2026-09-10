import assert from "node:assert/strict";
import { test } from "node:test";
import { validateExamWorksheet } from "../src/lib/report-engine";
import { defaultWorksheet, defaultOb, defaultThyroid } from "../src/lib/sonoflow-types";

// Helper function modeling dnd-kit arrayMove logic for section reordering
function reorderOrgans<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...list];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

test("worksheet workflow: supports customizable drag-and-drop organ section ordering", () => {
  const standardOrder = ["liver", "gallbladder", "pancreas", "spleen", "rightKidney", "leftKidney", "aorta"];
  
  // Doctor customizes routine to scan kidneys first
  const customOrder = reorderOrgans(standardOrder, standardOrder.indexOf("rightKidney"), 0);

  assert.equal(customOrder[0], "rightKidney");
  assert.equal(customOrder[1], "liver");
  assert.equal(customOrder.length, standardOrder.length);
  assert.deepEqual(new Set(customOrder), new Set(standardOrder));
});

test("clinical validator: flags impossible measurements as critical errors", () => {
  // Impossible liver measurement (600 mm = 60 cm)
  const badLiverIssues = validateExamWorksheet("Abdomen", {
    ...defaultWorksheet,
    liver: { ...defaultWorksheet.liver, size: "60.0" },
  });
  assert.ok(badLiverIssues.some((issue) => issue.level === "error" && issue.field.includes("liver")));

  // Impossible fetal heart rate (450 bpm)
  const badObIssues = validateExamWorksheet("OB", {
    ...defaultOb,
    fetalHeartRate: "450",
  });
  assert.ok(badObIssues.some((issue) => issue.level === "error" && issue.field.includes("fetalHeartRate")));
});

test("clinical validator: accepts standard physiological ranges without error", () => {
  const normalAbdomenIssues = validateExamWorksheet("Abdomen", {
    ...defaultWorksheet,
    liver: { ...defaultWorksheet.liver, size: "14.5" },
    gallbladder: { ...defaultWorksheet.gallbladder, wallThickness: "2.5" },
  });
  const criticalErrors = normalAbdomenIssues.filter((i) => i.level === "error");
  assert.equal(criticalErrors.length, 0);

  const normalObIssues = validateExamWorksheet("OB", {
    ...defaultOb,
    fetalHeartRate: "145",
  });
  const obErrors = normalObIssues.filter((i) => i.level === "error");
  assert.equal(obErrors.length, 0);
});
