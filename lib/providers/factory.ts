import { getEnv } from "@/lib/env";
import { FacebookProvider } from "./facebook-provider";
import { MockProvider } from "./mock-provider";
import type { InsightProvider } from "./types";

/**
 * Real providers land one at a time (PROMPT.md Stage 6), starting with
 * Facebook. INSIGHT_PROVIDER defaults to "mock" and stages 1-5 must never need
 * that changed — CLAUDE.md rule 2.
 *
 * Instagram and TikTok stay unimplemented on purpose: their metric and
 * endpoint names have not been verified against current docs, and rule 1
 * forbids writing them from memory.
 */
export function getProvider(): InsightProvider {
  const env = getEnv();

  switch (env.INSIGHT_PROVIDER) {
    case "mock":
      return new MockProvider();

    case "facebook": {
      const missing = [
        env.FACEBOOK_PAGE_ID ? null : "FACEBOOK_PAGE_ID",
        env.FACEBOOK_PAGE_ACCESS_TOKEN ? null : "FACEBOOK_PAGE_ACCESS_TOKEN",
      ].filter((name): name is string => name !== null);

      if (missing.length > 0) {
        throw new Error(
          `INSIGHT_PROVIDER=facebook needs ${missing.join(" and ")} in the environment. ` +
            `Set INSIGHT_PROVIDER=mock to keep running on generated data.`,
        );
      }

      return new FacebookProvider({
        pageId: env.FACEBOOK_PAGE_ID,
        accessToken: env.FACEBOOK_PAGE_ACCESS_TOKEN,
        lookbackDays: env.FACEBOOK_LOOKBACK_DAYS,
        graphVersion: env.FACEBOOK_GRAPH_VERSION || undefined,
      });
    }

    default:
      throw new Error(
        `INSIGHT_PROVIDER="${env.INSIGHT_PROVIDER}" is not implemented yet (Stage 6 does Facebook first, ` +
          `then Instagram and TikTok once their metric names are verified against current docs). ` +
          `Set INSIGHT_PROVIDER=mock until then.`,
      );
  }
}
