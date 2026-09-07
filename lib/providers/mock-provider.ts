import type { ProviderKind } from "@prisma/client";
import { getEnv } from "@/lib/env";
import { generateMockUniverse } from "./mock/generate";
import type {
  InsightProvider,
  ProviderAccountRef,
  ProviderFetchResult,
} from "./types";

/**
 * Generates a deterministic ~120-content universe across 3 platforms (see
 * lib/providers/mock/generate.ts) instead of calling any real API. This is
 * the only provider allowed to run until Meta/TikTok App Review is approved —
 * see CLAUDE.md rule 2.
 */
export class MockProvider implements InsightProvider {
  readonly kind: ProviderKind = "mock";

  private universeCache: ReturnType<typeof generateMockUniverse> | null = null;

  private universe() {
    if (!this.universeCache) {
      this.universeCache = generateMockUniverse(getEnv().MOCK_SEED);
    }
    return this.universeCache;
  }

  async listAccounts(): Promise<ProviderAccountRef[]> {
    return this.universe().map((a) => a.account);
  }

  async fetchAccountData(account: ProviderAccountRef): Promise<ProviderFetchResult> {
    const generated = this.universe().find(
      (a) => a.account.platform === account.platform && a.account.externalId === account.externalId,
    );
    if (!generated) {
      throw new Error(
        `MockProvider has no generated data for ${account.platform}/${account.externalId} — call listAccounts() first`,
      );
    }

    return {
      contents: generated.contents,
      contentMetrics: generated.contentMetrics,
      accountMetrics: generated.accountMetrics,
      rawPayloads: [
        { endpoint: "content.list", payload: generated.contents },
        { endpoint: "content.metrics", payload: generated.contentMetrics },
        { endpoint: "account.metrics", payload: generated.accountMetrics },
      ],
    };
  }
}
