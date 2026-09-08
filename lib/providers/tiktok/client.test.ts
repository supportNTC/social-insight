import { describe, expect, it } from "vitest";
import { TikTokApiError, TikTokClient, type TikTokFetch, type TikTokHttpResponse } from "./client";

function ok(body: unknown): TikTokHttpResponse {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

function fail(status: number, body: unknown): TikTokHttpResponse {
  return { ok: false, status, text: async () => JSON.stringify(body) };
}

function recorder(responses: TikTokHttpResponse[]) {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
  const fetchImpl: TikTokFetch = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    const next = responses.shift();
    if (!next) throw new Error(`No queued response for ${url}`);
    return next;
  };
  return { calls, fetchImpl };
}

const base = { accessToken: "secret-token", baseUrl: "https://tiktok.example", sleep: async () => {} };

describe("TikTokClient.get", () => {
  it("builds a versioned URL with query params and a Bearer header, never the token in the URL", async () => {
    const { calls, fetchImpl } = recorder([ok({ data: { open_id: "1" }, error: { code: "ok" } })]);
    const client = new TikTokClient({ ...base, version: "v2", fetchImpl });

    await client.get("user/info/", { fields: "open_id,display_name" });

    expect(calls[0]?.url).toBe("https://tiktok.example/v2/user/info/?fields=open_id%2Cdisplay_name");
    expect(calls[0]?.url).not.toContain("secret-token");
    expect(calls[0]?.headers.Authorization).toBe("Bearer secret-token");
    expect(calls[0]?.method).toBe("GET");
  });

  it("treats an HTTP 200 with a non-ok error.code as a failure", async () => {
    const { fetchImpl } = recorder([ok({ data: {}, error: { code: "invalid_params", message: "bad field" } })]);
    const client = new TikTokClient({ ...base, fetchImpl });

    await expect(client.get("user/info/")).rejects.toThrow(TikTokApiError);
  });

  it("does not retry a 4xx", async () => {
    const { calls, fetchImpl } = recorder([fail(400, { error: { code: "invalid_params" } })]);
    const client = new TikTokClient({ ...base, fetchImpl, maxAttempts: 3 });

    await expect(client.get("user/info/")).rejects.toThrow(TikTokApiError);
    expect(calls).toHaveLength(1);
  });

  it("retries a rate limit and a server error, then succeeds", async () => {
    const { calls, fetchImpl } = recorder([
      fail(429, { error: { code: "rate_limit" } }),
      fail(500, { error: { code: "server_error" } }),
      ok({ data: { open_id: "1" }, error: { code: "ok" } }),
    ]);
    const client = new TikTokClient({ ...base, fetchImpl, maxAttempts: 3 });

    await expect(client.get("user/info/")).resolves.toEqual({ data: { open_id: "1" }, error: { code: "ok" } });
    expect(calls).toHaveLength(3);
  });

  it("reports a non-JSON body instead of crashing on parse", async () => {
    const fetchImpl: TikTokFetch = async () => ({ ok: true, status: 200, text: async () => "<html>nope</html>" });
    const client = new TikTokClient({ ...base, fetchImpl });

    await expect(client.get("user/info/")).rejects.toThrow(/non-JSON body/);
  });
});

describe("TikTokClient.post", () => {
  it("sends fields on the query string and the rest as a JSON body", async () => {
    const { calls, fetchImpl } = recorder([ok({ data: { videos: [] }, error: { code: "ok" } })]);
    const client = new TikTokClient({ ...base, fetchImpl });

    await client.post("video/query/", { fields: "id,view_count" }, { filters: { video_ids: ["1", "2"] } });

    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toContain("fields=id%2Cview_count");
    expect(calls[0]?.body).toBe(JSON.stringify({ filters: { video_ids: ["1", "2"] } }));
  });
});
