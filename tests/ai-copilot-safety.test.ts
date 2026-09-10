import assert from "node:assert/strict";
import { test } from "node:test";
import { preservesNumericFacts, reportAiRequest } from "../src/lib/report-ai-safety";

test("ai copilot: retains complex multi-organ measurement blocks without alteration", () => {
  const originalReport = `
FINDINGS:
LIVER: Measures 14.5 cm in span. Smooth contour.
GALLBLADDER: Wall thickness 2.8 mm. No gallstones.
PANCREAS: Normal. Duct measures 1.5 mm.
SPLEEN: Length 10.2 cm.
KIDNEYS: Right kidney 11.0 cm, left kidney 11.4 cm. Cortical thickness 1.6 cm.

IMPRESSION:
Normal abdominal ultrasound examination.
  `.trim();

  // Permissible phrasing refinement by AI that keeps exact numbers
  const refinedReport = `
FINDINGS:
LIVER: 14.5 cm span with smooth contour.
GALLBLADDER: Wall thickness normal at 2.8 mm. Absence of gallstones.
PANCREAS: Normal caliber duct at 1.5 mm.
SPLEEN: Normal splenic span at 10.2 cm.
KIDNEYS: Right kidney 11.0 cm; left kidney 11.4 cm. Parenchymal cortical thickness 1.6 cm.

IMPRESSION:
Unremarkable complete abdominal ultrasound.
  `.trim();

  assert.equal(preservesNumericFacts(originalReport, refinedReport), true);
});

test("ai copilot: detects and rejects unit modifications, altered numbers, and invented findings", () => {
  const baseline = "Gallbladder wall measures 3.2 mm. Common bile duct measures 4.5 mm.";
  
  // Changed unit from mm to cm
  const badUnit = "Gallbladder wall measures 3.2 cm. Common bile duct measures 4.5 mm.";
  assert.equal(preservesNumericFacts(baseline, badUnit), false);

  // Altered numeric measurement (4.5 to 4.9)
  const alteredNumber = "Gallbladder wall measures 3.2 mm. Common bile duct measures 4.9 mm.";
  assert.equal(preservesNumericFacts(baseline, alteredNumber), false);

  // Invented additional finding and measurement
  const inventedMeasurement = `${baseline} Liver span measures 15.2 cm.`;
  assert.equal(preservesNumericFacts(baseline, inventedMeasurement), false);

  // Dropped measurement
  const droppedMeasurement = "Gallbladder wall measures 3.2 mm. Common bile duct normal.";
  assert.equal(preservesNumericFacts(baseline, droppedMeasurement), false);
});

test("ai copilot: sanitizes and validates instruction length and prompt boundaries", () => {
  // Test instruction length boundaries (max length check)
  const hugeInstruction = "Make it concise. ".repeat(400);
  const parseResult = reportAiRequest.safeParse({
    action: "edit",
    reportText: "Normal liver.",
    instruction: hugeInstruction,
  });
  assert.equal(parseResult.success, false);

  // Test valid concise prompt
  const validResult = reportAiRequest.safeParse({
    action: "edit",
    reportText: "Normal liver.",
    instruction: "Emphasize 6-month follow-up for the solitary cyst in right lobe.",
  });
  assert.equal(validResult.success, true);
});
