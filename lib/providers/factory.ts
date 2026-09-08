import { getEnv } from "@/lib/env";
import { FacebookProvider } from "./facebook-provider";
import { InstagramProvider } from "./instagram-provider";
import { TikTokProvider } from "./tiktok-provider";
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

    case "instagram": {
      const missing = [
        env.INSTAGRAM_PAGE_ID ? null : "INSTAGRAM_PAGE_ID",
        env.INSTAGRAM_ACCESS_TOKEN ? null : "INSTAGRAM_ACCESS_TOKEN",
      ].filter((name): name is string => name !== null);

      if (missing.length > 0) {
        throw new Error(
          `INSIGHT_PROVIDER=instagram needs ${missing.join(" and ")} in the environment. ` +
            `Set INSIGHT_PROVIDER=mock to keep running on generated data.`,
        );
      }

      return new InstagramProvider({
        pageId: env.INSTAGRAM_PAGE_ID,
        accessToken: env.INSTAGRAM_ACCESS_TOKEN,
        lookbackDays: env.INSTAGRAM_LOOKBACK_DAYS,
        graphVersion: env.INSTAGRAM_GRAPH_VERSION || undefined,
      });
    }

    case "tiktok": {
      if (!env.TIKTOK_ACCESS_TOKEN) {
        throw new Error(
          "INSIGHT_PROVIDER=tiktok needs TIKTOK_ACCESS_TOKEN in the environment. " +
            "Set INSIGHT_PROVIDER=mock to keep running on generated data.",
        );
      }

      return new TikTokProvider({
        accessToken: env.TIKTOK_ACCESS_TOKEN,
        lookbackDays: env.TIKTOK_LOOKBACK_DAYS,
      });
    }
  }
}
