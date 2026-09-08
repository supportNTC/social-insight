import { TIKTOK_API_BASE_URL, TIKTOK_API_VERSION } from "./api-spec";

/**
 * A very small TikTok v2 API client. Same shape of discipline as
 * lib/providers/meta/graph-client.ts (typed errors, bounded retries, raw body
 * kept for raw_payloads) but a separate class — TikTok's request shape
 * (POST + JSON body + query-string fields, and an `error.code` envelope
 * instead of Meta's HTTP-status-only errors) is different enough that
 * sharing GraphClient would mean bending it to fit, not reusing it.
 */

export type TikTokFetch = (
  url: string,
  init: { method: "GET" | "POST"; headers: Record<string, string>; body?: string },
) => Promise<TikTokHttpResponse>;

export type TikTokHttpResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

export type TikTokClientOptions = {
  accessToken: string;
  baseUrl?: string;
  version?: string;
  fetchImpl?: TikTokFetch;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
};

/** TikTok's own error envelope: `error.code` is a string ("ok" on success), not an HTTP status. */
export type TikTokErrorBody = {
  code?: string;
  message?: string;
  log_id?: string;
};

export class TikTokApiError extends Error {
  readonly status: number;
  readonly apiError: TikTokErrorBody | null;
  readonly endpoint: string;

  constructor(args: { status: number; endpoint: string; apiError: TikTokErrorBody | null; body: string }) {
    const detail = args.apiError?.message ?? args.body.slice(0, 200);
    super(`TikTok API ${args.status} on ${args.endpoint}: ${detail}`);
    this.name = "TikTokApiError";
    this.status = args.status;
    this.endpoint = args.endpoint;
    this.apiError = args.apiError;
  }
}

const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

export class TikTokClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly version: string;
  private readonly fetchImpl: TikTokFetch;
  private readonly maxAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: TikTokClientOptions) {
    this.accessToken = options.accessToken;
    this.baseUrl = options.baseUrl ?? TIKTOK_API_BASE_URL;
    this.version = options.version ?? TIKTOK_API_VERSION;
    this.fetchImpl = options.fetchImpl ?? defaultFetch;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** GET, with `fields` (and any other params) as query string. */
  async get(path: string, params: Record<string, string | number | undefined> = {}): Promise<unknown> {
    const url = this.buildUrl(path, params);
    return this.send("GET", url, path, undefined);
  }

  /** POST with a JSON body; `params` (e.g. `fields`) still go on the query string, per the documented example requests. */
  async post(
    path: string,
    params: Record<string, string | number | undefined>,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const url = this.buildUrl(path, params);
    return this.send("POST", url, path, JSON.stringify(body));
  }

  private buildUrl(path: string, params: Record<string, string | number | undefined>): string {
    const url = new URL(`${this.baseUrl}/${this.version}/${path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async send(method: "GET" | "POST", url: string, endpointLabel: string, body: string | undefined): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
          body,
        });
        const text = await response.text();
        const parsed = parseJson(text, endpointLabel);
        const apiError = extractApiError(parsed);

        // TikTok can return HTTP 200 with a non-"ok" error.code, so both are checked.
        if (response.ok && (apiError === null || apiError.code === "ok")) return parsed;

        const error = new TikTokApiError({ status: response.status, endpoint: endpointLabel, apiError, body: text });
        if (!isRetryableStatus(response.status) || attempt === this.maxAttempts) throw error;
        lastError = error;
      } catch (error) {
        if (error instanceof TikTokApiError && !isRetryableStatus(error.status)) throw error;
        if (attempt === this.maxAttempts) throw error;
        lastError = error;
      }

      await this.sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function parseJson(body: string, endpointLabel: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`TikTok API returned a non-JSON body on ${endpointLabel}: ${body.slice(0, 200)}`);
  }
}

function extractApiError(payload: unknown): TikTokErrorBody | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = (payload as Record<string, unknown>).error;
  if (typeof error !== "object" || error === null) return null;
  return error as TikTokErrorBody;
}

const defaultFetch: TikTokFetch = async (url, init) => {
  const response = await fetch(url, { method: init.method, headers: init.headers, body: init.body });
  return { ok: response.ok, status: response.status, text: () => response.text() };
};
