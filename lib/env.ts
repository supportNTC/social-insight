import { z } from "zod";

/**
 * Server-side environment. Do not import this from a "use client" module —
 * it reads secrets.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  INSIGHT_PROVIDER: z
    .enum(["mock", "facebook", "instagram", "tiktok"])
    .default("mock"),

  // ---- Instagram provider (Stage 6) -----------------------------------------
  // Instagram Business accounts are read through the connected Facebook Page's
  // token (confirmed: same graph.facebook.com Graph API as FacebookProvider).
  INSTAGRAM_PAGE_ID: z.string().default(""),
  INSTAGRAM_ACCESS_TOKEN: z.string().default(""),
  INSTAGRAM_GRAPH_VERSION: z.string().default(""),
  INSTAGRAM_LOOKBACK_DAYS: z.coerce.number().int().gt(0).lte(365).default(90),

  // ---- TikTok provider (Stage 6) ---------------------------------------------
  // TikTok for Developers (open.tiktokapis.com/v2) OAuth access token for the
  // account's own login, not a TikTok Business/Marketing API credential — see
  // lib/providers/tiktok/api-spec.ts for why.
  TIKTOK_ACCESS_TOKEN: z.string().default(""),
  TIKTOK_LOOKBACK_DAYS: z.coerce.number().int().gt(0).lte(365).default(90),

  /** Fixed seed keeps MockProvider deterministic across runs. */
  MOCK_SEED: z.string().default("20260907"),

  /** Required only by the /api/sync route; empty disables that route. */
  SYNC_SECRET: z.string().default(""),

  // ---- "Underperforming" funnel thresholds (Stage 5) -----------------------
  // Marketing tunes these without a code change. Each is a *fraction of the
  // account's own normal*, so 0.5 = "below half of this account's median".
  // Keep the defaults in sync with DEFAULT_UNDERPERFORMANCE_THRESHOLDS.
  UNDERPERFORMANCE_REACH_RATIO: ratio(0.5),
  UNDERPERFORMANCE_VIEWS_RATIO: ratio(0.5),
  UNDERPERFORMANCE_SCORE: ratio(0.5),

  /** Stage 6. Empty while running on the mock provider. */
  TOKEN_ENCRYPTION_KEY: z.string().default(""),
  FACEBOOK_APP_ID: z.string().default(""),
  FACEBOOK_APP_SECRET: z.string().default(""),

  // ---- Facebook provider (Stage 6) ------------------------------------------
  // Only read when INSIGHT_PROVIDER=facebook; the factory fails with a clear
  // message if any of them is still empty. The token is a secret: it is read
  // from here and sent as an Authorization header, never written to the
  // database and never put in a query string (CLAUDE.md rule 5).
  FACEBOOK_PAGE_ID: z.string().default(""),
  FACEBOOK_PAGE_ACCESS_TOKEN: z.string().default(""),
  /** Pin a Graph API version. Empty = the version verified in api-spec.ts. */
  FACEBOOK_GRAPH_VERSION: z.string().default(""),
  /** How many days of posts each sync walks back over. */
  FACEBOOK_LOOKBACK_DAYS: z.coerce.number().int().gt(0).lte(365).default(90),
});

/**
 * A 0..1 threshold read from the environment. An unset OR blank value falls
 * back to the default (a blank would otherwise coerce to 0). Rejects 0 and
 * anything above 1: a 0 threshold would silently disable a funnel step, and
 * a >1 threshold would flag content performing *at* normal as broken.
 */
function ratio(fallback: number) {
  return z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().gt(0).lte(1).default(fallback),
  );
}

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

/** True while the app is running entirely on generated data. */
export function isMockProvider(): boolean {
  return getEnv().INSIGHT_PROVIDER === "mock";
}
