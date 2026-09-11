import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPatientName(
  patient?: {
    firstName?: string | null;
    lastName?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null,
  fallback = "—"
): string {
  if (!patient) return fallback;
  const first = (patient.firstName ?? patient.first_name ?? "").trim();
  const last = (patient.lastName ?? patient.last_name ?? "").trim();
  const full = [first, last].filter(Boolean).join(" ");
  return full || fallback;
}
