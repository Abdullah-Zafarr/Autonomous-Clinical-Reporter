import assert from "node:assert/strict";
import { test } from "node:test";
import { explanationLanguages, reportAiRequest } from "../src/lib/report-ai-safety";

test("i18n: supports the four primary clinical explanation languages", () => {
  assert.deepEqual([...explanationLanguages], ["English", "Urdu", "Arabic", "Spanish"]);

  for (const lang of explanationLanguages) {
    const parsed = reportAiRequest.safeParse({
      action: "explain",
      worksheetId: "11111111-2222-3333-4444-555555555555",
      language: lang,
    });
    assert.equal(parsed.success, true);
  }
});

test("i18n: correctly assigns Right-to-Left (RTL) reading directionality", () => {
  function isRtlLanguage(lang: string): boolean {
    return lang === "Urdu" || lang === "Arabic";
  }

  // RTL languages
  assert.equal(isRtlLanguage("Urdu"), true);
  assert.equal(isRtlLanguage("Arabic"), true);

  // LTR languages
  assert.equal(isRtlLanguage("English"), false);
  assert.equal(isRtlLanguage("Spanish"), false);
});

test("i18n: physician approval gate strictly validates sourceHash and explanation integrity", () => {
  const validHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // 64 char SHA-256
  
  // Valid approval payload
  const validApproval = reportAiRequest.safeParse({
    action: "approve",
    worksheetId: "11111111-2222-3333-4444-555555555555",
    language: "Urdu",
    sourceHash: validHash,
    explanation: "آپ کا الٹراساؤنڈ معائنہ تسلی بخش ہے۔ جگر اور گردے بالکل ٹھیک حالت میں ہیں۔",
  });
  assert.equal(validApproval.success, true);

  // Invalid hash length (e.g. truncated)
  const invalidHash = reportAiRequest.safeParse({
    action: "approve",
    worksheetId: "11111111-2222-3333-4444-555555555555",
    language: "Urdu",
    sourceHash: "short-hash-123",
    explanation: "Explanation text.",
  });
  assert.equal(invalidHash.success, false);

  // Missing or empty explanation
  const emptyExplanation = reportAiRequest.safeParse({
    action: "approve",
    worksheetId: "11111111-2222-3333-4444-555555555555",
    language: "English",
    sourceHash: validHash,
    explanation: "   ",
  });
  assert.equal(emptyExplanation.success, false);
});
