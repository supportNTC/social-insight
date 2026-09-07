import { prisma } from "@/lib/db";
import { snapshotDateFromColumn, type SnapshotDate } from "@/lib/datetime";

/**
 * The last day we actually have account-level data for. Every "today" in the
 * query layer anchors to this, never to wall-clock `new Date()` — a real
 * sync can lag behind real time, and MockProvider's universe is permanently
 * frozen at MOCK_SEED's date. Anchoring to real time would silently show
 * empty days past whatever the last sync covered.
 */
export async function getLatestDataDate(): Promise<SnapshotDate | null> {
  const result = await prisma.accountMetricDaily.aggregate({
    _max: { snapshotDate: true },
  });
  const value = result._max.snapshotDate;
  return value ? snapshotDateFromColumn(value) : null;
}
