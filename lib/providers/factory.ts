import { getEnv } from "@/lib/env";
import { MockProvider } from "./mock-provider";
import type { InsightProvider } from "./types";

/**
 * Real providers land one at a time in Stage 6, starting with Facebook — see
 * PROMPT.md. CLAUDE.md rule 1 forbids guessing a platform's metric/endpoint
 * names from memory, so there is nothing to implement here yet beyond a
 * clear error; INSIGHT_PROVIDER defaults to "mock" and stages 1-5 must never
 * need to change that.
 */
export function getProvider(): InsightProvider {
  const provider = getEnv().INSIGHT_PROVIDER;

  if (provider === "mock") {
    return new MockProvider();
  }

  throw new Error(
    `INSIGHT_PROVIDER="${provider}" is not implemented yet (Stage 6 — real providers, starting with Facebook). ` +
      `Set INSIGHT_PROVIDER=mock until then.`,
  );
}
