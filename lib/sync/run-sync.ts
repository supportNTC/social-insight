import { Prisma, type Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { snapshotDateToColumn } from "@/lib/datetime";
import type {
  InsightProvider,
  ProviderAccountMetric,
  ProviderAccountRef,
  ProviderContent,
  ProviderContentMetric,
} from "@/lib/providers/types";

export type SyncOptions = {
  /** Fetch and report only — never touches the database, not even sync_runs. */
  dryRun?: boolean;
};

export type AccountSyncResult = {
  platform: string;
  externalId: string;
  /** Null in --dry mode: nothing was written, so there is no row to point to. */
  accountId: string | null;
  status: "success" | "failed";
  itemsSynced: number;
  errorMessage: string | null;
};

export type SyncResult = {
  provider: string;
  dryRun: boolean;
  accounts: AccountSyncResult[];
};

/**
 * One pass of the sync engine: list every account the provider knows about,
 * fetch its data, and upsert it into the database. Upserting on each table's
 * natural unique key (platform+externalId, contentId+snapshotDate, ...) is
 * what makes this idempotent — running it twice on the same day updates the
 * same rows instead of inserting duplicates.
 */
export async function runSync(
  provider: InsightProvider,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const dryRun = options.dryRun ?? false;
  const accountRefs = await provider.listAccounts();

  const accounts: AccountSyncResult[] = [];
  for (const accountRef of accountRefs) {
    accounts.push(await syncAccount(provider, accountRef, dryRun));
  }

  return { provider: provider.kind, dryRun, accounts };
}

async function syncAccount(
  provider: InsightProvider,
  accountRef: ProviderAccountRef,
  dryRun: boolean,
): Promise<AccountSyncResult> {
  if (dryRun) {
    try {
      const data = await provider.fetchAccountData(accountRef);
      const itemsSynced =
        data.contents.length + data.contentMetrics.length + data.accountMetrics.length;
      return {
        platform: accountRef.platform,
        externalId: accountRef.externalId,
        accountId: null,
        status: "success",
        itemsSynced,
        errorMessage: null,
      };
    } catch (error) {
      return {
        platform: accountRef.platform,
        externalId: accountRef.externalId,
        accountId: null,
        status: "failed",
        itemsSynced: 0,
        errorMessage: toErrorMessage(error),
      };
    }
  }

  const account = await prisma.account.upsert({
    where: {
      platform_externalId: { platform: accountRef.platform, externalId: accountRef.externalId },
    },
    update: { name: accountRef.name, timezone: accountRef.timezone },
    create: {
      platform: accountRef.platform,
      externalId: accountRef.externalId,
      name: accountRef.name,
      timezone: accountRef.timezone,
    },
  });

  const syncRun = await prisma.syncRun.create({
    data: { accountId: account.id, provider: provider.kind, status: "running" },
  });

  try {
    const data = await provider.fetchAccountData(accountRef);

    // Raw payloads land first, verbatim — PROMPT.md rule 3: normalization
    // must always be replayable from these without calling the provider again.
    for (const raw of data.rawPayloads) {
      await prisma.rawPayload.create({
        data: {
          accountId: account.id,
          provider: provider.kind,
          endpoint: raw.endpoint,
          payload: raw.payload as Prisma.InputJsonValue,
          syncRunId: syncRun.id,
        },
      });
    }

    const contentIdByExternalId = await upsertContents(account.id, accountRef.platform, data.contents);
    const contentMetricCount = await upsertContentMetrics(contentIdByExternalId, data.contentMetrics);
    const accountMetricCount = await upsertAccountMetrics(account.id, data.accountMetrics);

    const itemsSynced = data.contents.length + contentMetricCount + accountMetricCount;

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: "success", finishedAt: new Date(), itemsSynced },
    });

    return {
      platform: accountRef.platform,
      externalId: accountRef.externalId,
      accountId: account.id,
      status: "success",
      itemsSynced,
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: "failed", finishedAt: new Date(), errorMessage },
    });
    return {
      platform: accountRef.platform,
      externalId: accountRef.externalId,
      accountId: account.id,
      status: "failed",
      itemsSynced: 0,
      errorMessage,
    };
  }
}

async function upsertContents(
  accountId: string,
  platform: Platform,
  contents: ProviderContent[],
): Promise<Map<string, string>> {
  const rows = await mapInChunks(contents, 25, (c) =>
    prisma.content.upsert({
      where: { platform_externalId: { platform, externalId: c.externalId } },
      update: {
        caption: c.caption,
        permalink: c.permalink,
        thumbnailUrl: c.thumbnailUrl,
        durationSeconds: c.durationSeconds,
        tags: c.tags,
      },
      create: {
        accountId,
        platform,
        externalId: c.externalId,
        kind: c.kind,
        caption: c.caption,
        publishedAt: c.publishedAt,
        permalink: c.permalink,
        thumbnailUrl: c.thumbnailUrl,
        durationSeconds: c.durationSeconds,
        tags: c.tags,
      },
      select: { id: true, externalId: true },
    }),
  );

  const map = new Map<string, string>();
  for (const row of rows) map.set(row.externalId, row.id);
  return map;
}

async function upsertContentMetrics(
  contentIdByExternalId: Map<string, string>,
  metrics: ProviderContentMetric[],
): Promise<number> {
  let count = 0;
  await mapInChunks(metrics, 50, async (m) => {
    const contentId = contentIdByExternalId.get(m.contentExternalId);
    if (!contentId) {
      throw new Error(`No content row upserted for external id "${m.contentExternalId}"`);
    }
    const snapshotDate = snapshotDateToColumn(m.snapshotDate);
    await prisma.contentMetricDaily.upsert({
      where: { contentId_snapshotDate: { contentId, snapshotDate } },
      update: {
        views: m.views,
        reach: m.reach,
        likes: m.likes,
        comments: m.comments,
        shares: m.shares,
        saves: m.saves,
        avgWatchSeconds: m.avgWatchSeconds,
        completionRate: m.completionRate,
      },
      create: {
        contentId,
        snapshotDate,
        views: m.views,
        reach: m.reach,
        likes: m.likes,
        comments: m.comments,
        shares: m.shares,
        saves: m.saves,
        avgWatchSeconds: m.avgWatchSeconds,
        completionRate: m.completionRate,
      },
    });
    count += 1;
  });
  return count;
}

async function upsertAccountMetrics(
  accountId: string,
  metrics: ProviderAccountMetric[],
): Promise<number> {
  let count = 0;
  await mapInChunks(metrics, 50, async (m) => {
    const snapshotDate = snapshotDateToColumn(m.snapshotDate);
    await prisma.accountMetricDaily.upsert({
      where: { accountId_snapshotDate: { accountId, snapshotDate } },
      update: {
        followers: m.followers,
        followerDelta: m.followerDelta,
        views: m.views,
        reach: m.reach,
      },
      create: {
        accountId,
        snapshotDate,
        followers: m.followers,
        followerDelta: m.followerDelta,
        views: m.views,
        reach: m.reach,
      },
    });
    count += 1;
  });
  return count;
}

async function mapInChunks<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
