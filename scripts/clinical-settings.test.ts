import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_CLINICAL_SETTINGS,
  getClinicalSettings,
  saveClinicalSettings,
} from "../src/lib/clinical-settings";

test("DEFAULT_CLINICAL_SETTINGS provides valid clinical defaults", () => {
  assert.equal(DEFAULT_CLINICAL_SETTINGS.measurementUnit, "metric");
  assert.equal(DEFAULT_CLINICAL_SETTINGS.defaultReportStyle, "standard");
  assert.equal(DEFAULT_CLINICAL_SETTINGS.autoSaveIntervalMs, 1500);
  assert.equal(DEFAULT_CLINICAL_SETTINGS.eyeMaskStyle, "almond_soft");
  assert.equal(DEFAULT_CLINICAL_SETTINGS.markupColor, "#ef4444");
  assert.equal(DEFAULT_CLINICAL_SETTINGS.warnBeforeUnload, true);
});

test("getClinicalSettings returns default settings in node environment", () => {
  const settings = getClinicalSettings();
  assert.ok(settings);
  assert.equal(settings.measurementUnit, "metric");
  assert.equal(settings.autoSaveIntervalMs, 1500);
});

test("saveClinicalSettings merges partial preferences cleanly", () => {
  const updated = saveClinicalSettings({
    measurementUnit: "imperial",
    markupColor: "#0ea5e9",
  });
  assert.equal(updated.measurementUnit, "imperial");
  assert.equal(updated.markupColor, "#0ea5e9");
  assert.equal(updated.defaultReportStyle, "standard");
});
