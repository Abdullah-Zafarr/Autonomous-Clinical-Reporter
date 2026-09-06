import { z } from "zod";

export const explanationLanguages = ["English", "Urdu", "Arabic", "Spanish"] as const;
export const reportAiRequest = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("edit"),
    reportText: z.string().trim().min(1).max(24000),
    instruction: z.string().trim().min(1).max(1500),
  }),
  z.object({
    action: z.literal("explain"),
    worksheetId: z.string().uuid(),
    language: z.enum(explanationLanguages),
  }),
  z.object({
    action: z.literal("approve"),
    worksheetId: z.string().uuid(),
    language: z.enum(explanationLanguages),
    sourceHash: z.string().length(64),
    explanation: z.string().trim().min(1).max(24000),
  }),
]);

// Preserve numeric facts and units, including dates, while allowing list renumbering.
export function numericFacts(text: string): string[] {
  const withoutListNumbers = text.replace(/^\s*\d+[.)]\s+/gm, "");
  return [
    ...new Set(
      withoutListNumbers.match(/\d+(?:[.,]\d+)*(?:\s*(?:mm|cm|mL|ml|bpm|%|weeks?|days?))?/g) ?? [],
    ),
  ]
    .map((value) => value.replace(/\s+/g, "").toLowerCase())
    .sort();
}

export function preservesNumericFacts(original: string, revised: string): boolean {
  return JSON.stringify(numericFacts(original)) === JSON.stringify(numericFacts(revised));
}
