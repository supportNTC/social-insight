import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getProvider } from "@/lib/providers/factory";
import { runSync } from "@/lib/sync/run-sync";

/**
 * POST /api/sync — the cron-triggered twin of `pnpm sync`. Both call the same
 * runSync(), so they can never drift in behavior.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const env = getEnv();

  // Empty SYNC_SECRET disables the route entirely (see .env.example) rather
  // than falling back to "no auth required".
  if (!env.SYNC_SECRET || !secretMatches(request.headers.get("x-sync-secret"), env.SYNC_SECRET)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const dryRun = new URL(request.url).searchParams.get("dry") === "true";

  try {
    const provider = getProvider();
    const result = await runSync(provider, { dryRun });
    const hasFailure = result.accounts.some((a) => a.status === "failed");
    return NextResponse.json(result, { status: hasFailure ? 207 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

/** Constant-time comparison — a secret-gated endpoint shouldn't leak match-length via timing. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (provided === null) return false;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}
