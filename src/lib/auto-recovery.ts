"use client";

import type { KeyReportImage, WorksheetCorrection } from "./clinical-workflow-types";
import type { ExamType } from "./sonoflow-types";

export interface SessionBackup {
  backupId: string;
  savedAt: number; // Epoch timestamp ms
  savedAtIso: string;
  patientId: string;
  patientName?: string;
  mrn?: string;
  studyId?: string;
  accession?: string;
  exam: ExamType;
  worksheetPayload: {
    abdomen: unknown;
    abdomenOrder?: string[];
    thyroid: unknown;
    ob: unknown;
    vascular: unknown;
    additionalNotes: string;
  };
  editedReportText: string | null;
  additionalNotes: string;
  keyImages: KeyReportImage[];
  corrections?: WorksheetCorrection[];
  isDirty: boolean;
  source: "auto" | "heartbeat" | "manual" | "beforeunload";
}

const STORAGE_PREFIX = "sonolynx_crashproof_backup_";
const GLOBAL_POINTER_KEY = "sonolynx_last_active_backup_patient";

export function getBackupStorageKey(patientId: string): string {
  return `${STORAGE_PREFIX}${patientId || "default"}`;
}

/**
 * Saves an immediate snapshot of the current session state to persistent local storage.
 */
export function saveSessionBackup(backup: Omit<SessionBackup, "backupId" | "savedAt" | "savedAtIso">): SessionBackup | null {
  if (typeof window === "undefined") return null;

  const now = Date.now();
  const fullBackup: SessionBackup = {
    ...backup,
    backupId: crypto.randomUUID(),
    savedAt: now,
    savedAtIso: new Date(now).toISOString(),
  };

  const key = getBackupStorageKey(backup.patientId);

  try {
    const serialized = JSON.stringify(fullBackup);
    localStorage.setItem(key, serialized);
    if (backup.patientId) {
      localStorage.setItem(GLOBAL_POINTER_KEY, backup.patientId);
    }
    return fullBackup;
  } catch (err) {
    console.warn("localStorage quota exceeded for full backup, attempting lightweight backup:", err);
    try {
      // If quota exceeded (due to multiple attached images), save lightweight backup without images
      const lightweight: SessionBackup = {
        ...fullBackup,
        keyImages: fullBackup.keyImages.map((img) => ({
          ...img,
          dataUrl: "", // Strip dataUrl to conserve storage
        })),
      };
      localStorage.setItem(key, JSON.stringify(lightweight));
      return lightweight;
    } catch (fallbackErr) {
      console.error("Critical: failed to write backup to localStorage:", fallbackErr);
      return null;
    }
  }
}

/**
 * Retrieves the session backup for a specific patient.
 */
export function getSessionBackup(patientId: string): SessionBackup | null {
  if (typeof window === "undefined" || !patientId) return null;
  try {
    const raw = localStorage.getItem(getBackupStorageKey(patientId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionBackup;
    return parsed;
  } catch (err) {
    console.error("Failed to parse session backup:", err);
    return null;
  }
}

/**
 * Gets the last active patient ID that was backed up.
 */
export function getLastActiveBackupPatientId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(GLOBAL_POINTER_KEY);
  } catch {
    return null;
  }
}

/**
 * Clears backup when case is definitively signed or submitted.
 */
export function clearSessionBackup(patientId: string): void {
  if (typeof window === "undefined" || !patientId) return;
  try {
    localStorage.removeItem(getBackupStorageKey(patientId));
    if (localStorage.getItem(GLOBAL_POINTER_KEY) === patientId) {
      localStorage.removeItem(GLOBAL_POINTER_KEY);
    }
  } catch {}
}

/**
 * Checks whether a backup has uncommitted changes compared to what was loaded from server.
 */
export function hasRecoverableProgress(backup: SessionBackup | null, serverUpdatedAt?: string | null): boolean {
  if (!backup) return false;
  // If backup was dirty or has edited report text/notes
  if (backup.isDirty) return true;
  if (backup.editedReportText && backup.editedReportText.trim()) return true;
  if (backup.additionalNotes && backup.additionalNotes.trim()) return true;

  if (serverUpdatedAt) {
    const serverTime = new Date(serverUpdatedAt).getTime();
    return backup.savedAt > serverTime + 3000; // 3 seconds newer than server
  }

  return false;
}

/**
 * Formats timestamp into an authoritative clinical backup string.
 */
export function formatBackupTimestamp(timestamp: number | null): { absolute: string; relative: string } {
  if (!timestamp) {
    return { absolute: "No backup recorded", relative: "Never" };
  }

  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = (hours % 12 || 12).toString().padStart(2, "0");

  const absolute = `${formattedHours}:${minutes}:${seconds} ${ampm}`;

  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  let relative = "just now";
  if (diffSec >= 60) {
    const mins = Math.floor(diffSec / 60);
    relative = `${mins}m ago`;
  } else if (diffSec > 0) {
    relative = `${diffSec}s ago`;
  }

  return { absolute, relative };
}
