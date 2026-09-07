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

  /** Fixed seed keeps MockProvider deterministic across runs. */
  MOCK_SEED: z.string().default("20260907"),

  /** Required only by the /api/sync route; empty disables that route. */
  SYNC_SECRET: z.string().default(""),

  /** Stage 6. Empty while running on the mock provider. */
  TOKEN_ENCRYPTION_KEY: z.string().default(""),
  FACEBOOK_APP_ID: z.string().default(""),
  FACEBOOK_APP_SECRET: z.string().default(""),
});

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
