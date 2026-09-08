import { describe, expect, it } from "vitest";
import { GraphApiError, GraphClient, type GraphFetch, type GraphHttpResponse } from "./graph-client";

function ok(body: unknown): GraphHttpResponse {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

function fail(status: number, body: unknown): GraphHttpResponse {
  return { ok: false, status, text: async () => JSON.stringify(body) };
}

/** Records every URL/header the client sends and replies from a queue. */
function recorder(responses: GraphHttpResponse[]) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl: GraphFetch = async (url, init) => {
    calls.push({ url, headers: init.headers });
    const next = responses.shift();
    if (!next) throw new Error(`No queued response for ${url}`);
    return next;
  };
  return { calls, fetchImpl };
}

const base = { accessToken: "secret-token", baseUrl: "https://graph.example", sleep: async () => {} };

describe("GraphClient.get", () => {
  it("builds a versioned URL with the query params", async () => {
    const { calls, fetchImpl } = recorder([ok({ id: "1" })]);
    const client = new GraphClient({ ...base, version: "v25.0", fetchImpl });

    await client.get("123/insights", { metric: "page_follows", period: "day", skipped: undefined });

    expect(calls[0]?.url).toBe(
      "https://graph.example/v25.0/123/insights?metric=page_follows&period=day",
    );
  });

  it("sends the token as a header, never in the URL", async () => {
    const { calls, fetchImpl } = recorder([ok({})]);
    const client = new GraphClient({ ...base, fetchImpl });

    await client.get("123");

    // A token in the query string ends up in access logs and in raw_payloads.
    expect(calls[0]?.url).not.toContain("secret-token");
    expect(calls[0]?.headers.Authorization).toBe("Bearer secret-token");
  });

  it("surfaces the Graph error envelope", async () => {
    const { fetchImpl } = recorder([
      fail(400, { error: { message: "(#100) metric[0] must be a valid insights metric", code: 100 } }),
    ]);
    const client = new GraphClient({ ...base, fetchImpl });

    await expect(client.get("123/insights")).rejects.toThrow(GraphApiError);
  });

  it("does not retry a 4xx — the request itself is wrong", async () => {
    const { calls, fetchImpl } = recorder([fail(400, { error: { message: "bad metric" } })]);
    const client = new GraphClient({ ...base, fetchImpl, maxAttempts: 3 });

    await expect(client.get("123/insights")).rejects.toThrow(GraphApiError);
    expect(calls).toHaveLength(1);
  });

  it("retries a rate limit and a server error, then succeeds", async () => {
    const { calls, fetchImpl } = recorder([
      fail(429, { error: { message: "rate limited" } }),
      fail(500, { error: { message: "oops" } }),
      ok({ id: "1" }),
    ]);
    const client = new GraphClient({ ...base, fetchImpl, maxAttempts: 3 });

    await expect(client.get("123")).resolves.toEqual({ id: "1" });
    expect(calls).toHaveLength(3);
  });

  it("gives up after maxAttempts", async () => {
    const { calls, fetchImpl } = recorder([
      fail(500, {}),
      fail(500, {}),
      fail(500, {}),
    ]);
    const client = new GraphClient({ ...base, fetchImpl, maxAttempts: 3 });

    await expect(client.get("123")).rejects.toThrow(GraphApiError);
    expect(calls).toHaveLength(3);
  });

  it("reports a non-JSON body instead of crashing on parse", async () => {
    const fetchImpl: GraphFetch = async () => ({ ok: true, status: 200, text: async () => "<html>nope</html>" });
    const client = new GraphClient({ ...base, fetchImpl });

    await expect(client.get("123")).rejects.toThrow(/non-JSON body/);
  });
});

describe("GraphClient.getAllPages", () => {
  it("follows paging.next until it runs out and keeps every raw body", async () => {
    const { calls, fetchImpl } = recorder([
      ok({ data: [{ id: "1" }], paging: { next: "https://graph.example/v25.0/123/published_posts?after=A" } }),
      ok({ data: [{ id: "2" }] }),
    ]);
    const client = new GraphClient({ ...base, fetchImpl });

    const pages = await client.getAllPages("123/published_posts", { limit: 100 });

    expect(pages).toHaveLength(2);
    expect(pages.flatMap((p) => p.data)).toEqual([{ id: "1" }, { id: "2" }]);
    expect(pages[0]?.raw).toHaveProperty("paging");
    expect(calls[1]?.url).toBe("https://graph.example/v25.0/123/published_posts?after=A");
  });

  it("stops at maxPages so a cursor loop cannot run forever", async () => {
    const looping = ok({ data: [{ id: "1" }], paging: { next: "https://graph.example/next" } });
    const responses = Array.from({ length: 5 }, () => ({ ...looping }));
    const { calls, fetchImpl } = recorder(responses);
    const client = new GraphClient({ ...base, fetchImpl });

    const pages = await client.getAllPages("123/published_posts", {}, 3);

    expect(pages).toHaveLength(3);
    expect(calls).toHaveLength(3);
  });
});
