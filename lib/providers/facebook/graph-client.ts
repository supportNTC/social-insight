import { GRAPH_API_BASE_URL, GRAPH_API_VERSION } from "./api-spec";

/**
 * A very small Graph API client: build a versioned URL, send the token as a
 * header (never in the query string, where it would end up in logs and in
 * raw_payloads), retry what is safe to retry, and hand back the parsed JSON
 * plus the verbatim body for raw_payloads.
 *
 * It knows nothing about metrics or posts — every Graph-specific string lives
 * in api-spec.ts.
 */

export type GraphFetch = (url: string, init: { headers: Record<string, string> }) => Promise<GraphHttpResponse>;

/** The slice of the fetch Response this client uses — keeps tests free of a DOM. */
export type GraphHttpResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

export type GraphClientOptions = {
  accessToken: string;
  version?: string;
  baseUrl?: string;
  fetchImpl?: GraphFetch;
  /** Attempts per request, including the first. 1 disables retrying. */
  maxAttempts?: number;
  /** Injected in tests so retry logic does not actually wait. */
  sleep?: (ms: number) => Promise<void>;
};

/** A Graph error envelope, parsed defensively — every member may be absent. */
export type GraphErrorBody = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

export class GraphApiError extends Error {
  readonly status: number;
  readonly graphError: GraphErrorBody | null;
  readonly endpoint: string;

  constructor(args: { status: number; endpoint: string; graphError: GraphErrorBody | null; body: string }) {
    const detail = args.graphError?.message ?? args.body.slice(0, 200);
    super(`Graph API ${args.status} on ${args.endpoint}: ${detail}`);
    this.name = "GraphApiError";
    this.status = args.status;
    this.endpoint = args.endpoint;
    this.graphError = args.graphError;
  }
}

/** One page of a Graph edge response, plus the cursor to the next one. */
export type GraphPage = {
  data: unknown[];
  nextUrl: string | null;
  /** The verbatim response body, for raw_payloads (PROMPT.md rule 3). */
  raw: unknown;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

export class GraphClient {
  private readonly accessToken: string;
  private readonly version: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: GraphFetch;
  private readonly maxAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: GraphClientOptions) {
    this.accessToken = options.accessToken;
    this.version = options.version ?? GRAPH_API_VERSION;
    this.baseUrl = options.baseUrl ?? GRAPH_API_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? defaultFetch;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** GET one node/edge. `path` is everything after the version, e.g. "1234/insights". */
  async get(path: string, params: Record<string, string | number | undefined> = {}): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/${this.version}/${path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return this.getUrl(url.toString(), path);
  }

  /**
   * Follow `paging.next` until the edge is exhausted. Each page's verbatim body
   * is kept so the caller can persist all of them to raw_payloads.
   */
  async getAllPages(
    path: string,
    params: Record<string, string | number | undefined> = {},
    maxPages = 25,
  ): Promise<GraphPage[]> {
    const pages: GraphPage[] = [];
    let payload = await this.get(path, params);

    for (let i = 0; i < maxPages; i += 1) {
      const page = toGraphPage(payload);
      pages.push(page);
      // Stop before fetching a page we would not keep — the cap is there to
      // bound requests against a rate-limited API, not just to bound memory.
      if (!page.nextUrl || i === maxPages - 1) break;
      payload = await this.getUrl(page.nextUrl, path);
    }

    return pages;
  }

  private async getUrl(url: string, endpointLabel: string): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, {
          // Header, not ?access_token= — a query-string token leaks into every
          // log line, error message and stored raw payload.
          headers: { Authorization: `Bearer ${this.accessToken}`, Accept: "application/json" },
        });
        const body = await response.text();

        if (response.ok) return parseJson(body, endpointLabel);

        const graphError = extractGraphError(body);
        const error = new GraphApiError({ status: response.status, endpoint: endpointLabel, graphError, body });
        // 4xx other than 429 means the request itself is wrong (bad metric,
        // missing permission) — retrying just repeats the same mistake.
        if (!isRetryableStatus(response.status) || attempt === this.maxAttempts) throw error;
        lastError = error;
      } catch (error) {
        if (error instanceof GraphApiError && !isRetryableStatus(error.status)) throw error;
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
    throw new Error(`Graph API returned a non-JSON body on ${endpointLabel}: ${body.slice(0, 200)}`);
  }
}

function extractGraphError(body: string): GraphErrorBody | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null) return null;
    const error = (parsed as Record<string, unknown>).error;
    if (typeof error !== "object" || error === null) return null;
    return error as GraphErrorBody;
  } catch {
    return null;
  }
}

export function toGraphPage(payload: unknown): GraphPage {
  const record = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const data = Array.isArray(record.data) ? (record.data as unknown[]) : [];

  const paging = typeof record.paging === "object" && record.paging !== null
    ? (record.paging as Record<string, unknown>)
    : null;
  const next = paging && typeof paging.next === "string" ? paging.next : null;

  return { data, nextUrl: next, raw: payload };
}

const defaultFetch: GraphFetch = async (url, init) => {
  const response = await fetch(url, { headers: init.headers });
  return { ok: response.ok, status: response.status, text: () => response.text() };
};
