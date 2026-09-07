/**
 * CLI entrypoint for `pnpm sync` / `pnpm sync -- --dry`.
 *
 * Stage 1 only wires up argument parsing and the exit contract so the command
 * exists and typechecks. The engine itself lands in Stage 2
 * (lib/sync/engine.ts).
 */

interface SyncArgs {
  /** Fetch from the provider and log, but write nothing to the database. */
  dry: boolean;
}

function parseArgs(argv: readonly string[]): SyncArgs {
  return { dry: argv.includes("--dry") };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.error(
    `[sync] not implemented yet (dry=${args.dry}). The sync engine arrives in Stage 2.`,
  );
  process.exitCode = 1;
}

void main();
