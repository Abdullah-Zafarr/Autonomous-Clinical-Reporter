"use client";

import { useEffect, useState } from "react";
import { getStoredDoodleId, saveUserDoodleId } from "./clinical-doodles";

export interface ClinicalWorkspaceSettings {
  // Avatar & Profile
  doodleId: string;

  // Clinical & Reporting Defaults
  measurementUnit: "metric" | "imperial";
  defaultReportStyle: "standard" | "structured" | "concise";
  autoScrollFindings: boolean;
  markupColor: string; // Hex color for markup: #ef4444, #f59e0b, #0ea5e9, #10b981

  // Auto-Recovery & Crash Protection
  autoSaveIntervalMs: number; // 1500, 3000, 5000
  heartbeatIntervalSec: number; // 12, 30, 60
  warnBeforeUnload: boolean;
  soundOnReportSign: boolean;

  // DICOM & Viewer Display
  eyeMaskStyle: "almond_soft" | "crisp" | "disabled";
  viewerBackground: "pure_black" | "dark_slate";
  uiDensity: "comfortable" | "compact";

  // Compliance & Session
  hipaaAutoLockMinutes: number; // 15, 30, 60
}

export const DEFAULT_CLINICAL_SETTINGS: ClinicalWorkspaceSettings = {
  doodleId: "",
  measurementUnit: "metric",
  defaultReportStyle: "standard",
  autoScrollFindings: true,
  markupColor: "#ef4444",
  autoSaveIntervalMs: 1500,
  heartbeatIntervalSec: 12,
  warnBeforeUnload: true,
  soundOnReportSign: true,
  eyeMaskStyle: "almond_soft",
  viewerBackground: "pure_black",
  uiDensity: "comfortable",
  hipaaAutoLockMinutes: 30,
};

const SETTINGS_STORAGE_KEY = "sonolynx_clinical_settings_v1";
const SETTINGS_EVENT_NAME = "sonolynx_settings_changed";

/**
 * Retrieves stored workspace settings from localStorage.
 */
export function getClinicalSettings(): ClinicalWorkspaceSettings {
  if (typeof window === "undefined") return DEFAULT_CLINICAL_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_CLINICAL_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CLINICAL_SETTINGS, ...parsed };
  } catch (err) {
    console.warn("[settings] Failed to read clinical settings:", err);
    return DEFAULT_CLINICAL_SETTINGS;
  }
}

/**
 * Saves updated workspace settings to localStorage and notifies subscribers.
 */
export function saveClinicalSettings(
  partial: Partial<ClinicalWorkspaceSettings>
): ClinicalWorkspaceSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_CLINICAL_SETTINGS, ...partial };
  }

  try {
    const current = getClinicalSettings();
    const updated: ClinicalWorkspaceSettings = { ...current, ...partial };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));

    // Also sync doodleId if updated
    if (partial.doodleId !== undefined) {
      saveUserDoodleId(partial.doodleId);
    }

    window.dispatchEvent(
      new CustomEvent(SETTINGS_EVENT_NAME, { detail: updated })
    );
    return updated;
  } catch (err) {
    console.error("[settings] Failed to save clinical settings:", err);
    return DEFAULT_CLINICAL_SETTINGS;
  }
}

/**
 * React hook to read and update workspace settings reactively.
 */
export function useClinicalSettings() {
  const [settings, setSettings] = useState<ClinicalWorkspaceSettings>(
    getClinicalSettings()
  );

  useEffect(() => {
    // Initial sync
    setSettings(getClinicalSettings());

    const handleCustom = (e: Event) => {
      const custom = e as CustomEvent<ClinicalWorkspaceSettings>;
      if (custom.detail) {
        setSettings(custom.detail);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY) {
        setSettings(getClinicalSettings());
      }
    };

    window.addEventListener(SETTINGS_EVENT_NAME, handleCustom);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(SETTINGS_EVENT_NAME, handleCustom);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const updateSettings = (partial: Partial<ClinicalWorkspaceSettings>) => {
    const updated = saveClinicalSettings(partial);
    setSettings(updated);
    return updated;
  };

  const resetToDefaults = () => {
    const updated = saveClinicalSettings(DEFAULT_CLINICAL_SETTINGS);
    setSettings(updated);
    return updated;
  };

  return {
    settings,
    updateSettings,
    resetToDefaults,
  };
}
