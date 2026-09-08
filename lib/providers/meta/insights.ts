import { asArray, asFiniteNumber, asRecord, asString } from "./json-safe";

/**
 * The insights envelope ({data:[{name, values:[{value, end_time}]}]}) is the
 * same shape on every Meta Graph API insights endpoint — Facebook Page/Post
 * and Instagram Media/User all return it. Shared here so both providers read
 * it identically instead of each guessing their own parser is right.
 */

export type InsightEntry = { name: string; values: { value: unknown; endTime: string | null }[] };

/** Flattens the insights envelope into name -> values, ignoring anything malformed. */
export function parseInsights(raw: unknown): Map<string, InsightEntry> {
  const envelope = asRecord(raw);
  const out = new Map<string, InsightEntry>();
  if (!envelope) return out;

  for (const item of asArray(envelope.data)) {
    const entry = asRecord(item);
    if (!entry) continue;
    const name = asString(entry.name);
    if (!name) continue;

    const values = asArray(entry.values)
      .map((v) => asRecord(v))
      .filter((v): v is Record<string, unknown> => v !== null)
      .map((v) => ({ value: v.value, endTime: asString(v.end_time) }));

    out.set(name, { name, values });
  }

  return out;
}

/** The latest numeric value of a metric, or null when it is absent / non-numeric. */
export function latestNumber(insights: Map<string, InsightEntry>, metric: string): number | null {
  const entry = insights.get(metric);
  if (!entry) return null;

  for (let i = entry.values.length - 1; i >= 0; i -= 1) {
    const value = asFiniteNumber(entry.values[i]?.value);
    if (value !== null) return value;
  }
  return null;
}
