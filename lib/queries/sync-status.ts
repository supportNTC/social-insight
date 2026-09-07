import type { Platform, SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export type AccountSyncStatus = {
  accountId: string;
  platform: Platform;
  name: string;
  lastSync: { finishedAt: Date | null; status: SyncStatus; itemsSynced: number } | null;
};

/** Every account's most recent sync run — for the Settings page. */
export async function getAccountSyncStatuses(): Promise<AccountSyncStatus[]> {
  const accounts = await prisma.account.findMany({
    orderBy: { platform: "asc" },
    include: {
      syncRuns: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });

  return accounts.map((account) => {
    const last = account.syncRuns[0];
    return {
      accountId: account.id,
      platform: account.platform,
      name: account.name,
      lastSync: last
        ? { finishedAt: last.finishedAt, status: last.status, itemsSynced: last.itemsSynced }
        : null,
    };
  });
}

/** Most recent successfully-finished sync across every account — for the header badge. Null if nothing has ever synced. */
export async function getLatestSyncFinishedAt(): Promise<Date | null> {
  const latest = await prisma.syncRun.findFirst({
    where: { status: "success", NOT: { finishedAt: null } },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
  });
  return latest?.finishedAt ?? null;
}
