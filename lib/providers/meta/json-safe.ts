/**
 * Unknown-safe JSON readers shared by every Meta Graph API provider (Facebook,
 * Instagram — both return the same kind of loosely-typed JSON). Every access
 * is guarded so a shape change surfaces as a skipped value, never a crash or
 * a silent wrong number.
 */

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
