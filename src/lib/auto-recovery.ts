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
const STORAGE_HISTORY_PREFIX = "sonolynx_crashproof_backups_list_";
const GLOBAL_POINTER_KEY = "sonolynx_last_active_backup_patient";

export function getBackupStorageKey(patientId: string): string {
  return `${STORAGE_PREFIX}${patientId || "default"}`;
}

export function getBackupListStorageKey(patientId: string): string {
  return `${STORAGE_HISTORY_PREFIX}${patientId || "default"}`;
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
 * Retrieves all stored backup snapshots for a patient in descending order (newest first).
 */
export function getAllSessionBackups(patientId: string): SessionBackup[] {
  if (typeof window === "undefined" || !patientId) return [];
  try {
    const listKey = getBackupListStorageKey(patientId);
    const raw = localStorage.getItem(listKey);
    let backups: SessionBackup[] = [];
    if (raw) {
      try {
        backups = JSON.parse(raw) as SessionBackup[];
      } catch (parseErr) {
        console.warn("Could not parse backups history list:", parseErr);
      }
    }

    // Ensure latest single primary backup is in the list
    const primary = getSessionBackup(patientId);
    if (primary) {
      const alreadyIncluded = backups.some(
        (b) => b.backupId === primary.backupId || Math.abs(b.savedAt - primary.savedAt) < 1500
      );
      if (!alreadyIncluded) {
        backups.unshift(primary);
      }
    }

    // Sort newest first
    backups.sort((a, b) => b.savedAt - a.savedAt);
    return backups;
  } catch (err) {
    console.error("Failed to retrieve all session backups:", err);
    const fallback = getSessionBackup(patientId);
    return fallback ? [fallback] : [];
  }
}

/**
 * Saves an immediate snapshot of the current session state to persistent local storage.
 * Maintains a rolling history of up to 15 snapshots per patient.
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

  const appendToHistoryList = (snapshotToStore: SessionBackup) => {
    try {
      const existing = getAllSessionBackups(backup.patientId);
      // Avoid rapid-fire duplicates saved within 3 seconds with identical content
      const filtered = existing.filter((b) => Math.abs(b.savedAt - now) > 3000);
      const updatedList = [snapshotToStore, ...filtered].slice(0, 15);
      localStorage.setItem(getBackupListStorageKey(backup.patientId), JSON.stringify(updatedList));
    } catch (listErr) {
      console.warn("Could not write to backup history list:", listErr);
    }
  };

  try {
    const serialized = JSON.stringify(fullBackup);
    localStorage.setItem(key, serialized);
    if (backup.patientId) {
      localStorage.setItem(GLOBAL_POINTER_KEY, backup.patientId);
    }
    appendToHistoryList(fullBackup);
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
      appendToHistoryList(lightweight);
      return lightweight;
    } catch (fallbackErr) {
      console.error("Critical: failed to write backup to localStorage:", fallbackErr);
      return null;
    }
  }
}

/**
 * Deletes a specific snapshot from the history list.
 */
export function deleteSessionBackup(patientId: string, backupId: string): SessionBackup[] {
  if (typeof window === "undefined" || !patientId) return [];
  try {
    const existing = getAllSessionBackups(patientId);
    const updated = existing.filter((b) => b.backupId !== backupId);
    localStorage.setItem(getBackupListStorageKey(patientId), JSON.stringify(updated));

    const primary = getSessionBackup(patientId);
    if (primary && primary.backupId === backupId) {
      if (updated.length > 0) {
        localStorage.setItem(getBackupStorageKey(patientId), JSON.stringify(updated[0]));
      } else {
        localStorage.removeItem(getBackupStorageKey(patientId));
      }
    }
    return updated;
  } catch {
    return [];
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
    localStorage.removeItem(getBackupListStorageKey(patientId));
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
