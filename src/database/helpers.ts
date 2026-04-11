/**
 * Shared helpers for database layer (userData, threadData).
 * Keeps validation and payload normalization in one place.
 */

export const DB_NOT_INIT = "Database not initialized";

export function validateId(value: Loose, fieldName = "id"): string {
  if (value == null) {
    throw new Error(`${fieldName} is required and cannot be undefined`);
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`Invalid ${fieldName}: must be a string or number`);
  }
  return String(value);
}

export function validateData(data: Loose): void {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid data: must be a non-empty object");
  }
}

/** keys: "userID" | ["userID","data"] | null */
export function normalizeAttributes(keys: Loose): string[] | undefined {
  if (keys == null) return undefined;
  return typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : undefined;
}

/** Normalize payload: accept either { data } or raw object. */
export function normalizePayload(data: Loose, key = "data"): Record<string, Loose> {
  return Object.prototype.hasOwnProperty.call(data as object, key)
    ? (data as Record<string, Loose>)
    : { [key]: data };
}

export function wrapError(message: string, cause: Loose): Error {
  const c = cause as { message?: string } | undefined;
  return new Error(`${message}: ${c && c.message ? c.message : cause}`);
}
