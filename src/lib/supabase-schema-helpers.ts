/**
 * Detects whether a PostgREST / PostgreSQL error was caused by a column missing
 * in the PostgREST schema cache (e.g. PGRST204) or an undefined column (42703).
 */
export function isSchemaCacheError(error: any, column?: string): boolean {
  if (!error) return false;
  const code = error?.code;
  const msg = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  const isKnownCode = code === "PGRST204" || code === "42703";
  const hasCachePhrase =
    msg.includes("schema cache") ||
    (msg.includes("column") && (msg.includes("could not find") || msg.includes("does not exist")));

  if (!isKnownCode && !hasCachePhrase) return false;
  if (!column) return true;
  return msg.includes(column.toLowerCase());
}
