import { getProvider } from "@/lib/providers/factory";
import { runSync } from "@/lib/sync/run-sync";
import { prisma } from "@/lib/db";

/**
 * `pnpm sync` / `pnpm sync -- --dry`. Mirrors exactly what POST /api/sync
 * does (same runSync + provider), so a cron hitting the API route and a
 * developer running this by hand exercise identical logic.
 */
async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry");
  const provider = getProvider();

  console.log(`[sync] provider=${provider.kind} dryRun=${dryRun}`);

  const result = await runSync(provider, { dryRun });

  for (const account of result.accounts) {
    const label = `${account.platform}/${account.externalId}`;
    if (account.status === "success") {
      console.log(`[sync] ${label}: ok, ${account.itemsSynced} items`);
    } else {
      console.error(`[sync] ${label}: FAILED — ${account.errorMessage}`);
    }
  }

  const failed = result.accounts.filter((a) => a.status === "failed");
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error("[sync] fatal:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
