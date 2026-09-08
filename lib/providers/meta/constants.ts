/**
 * Facebook Pages and Instagram Business accounts are managed through the SAME
 * Graph API — same base URL, same version scheme, same Bearer-token auth.
 * Confirmed (not assumed by analogy): the Instagram get-started guide's own
 * example request calls `graph.facebook.com/v25.0/...` for
 * `instagram_business_account` (see lib/providers/instagram/api-spec.ts).
 *
 * Current version as of 2026-02-18 — see
 * https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/
 * Overridable per-provider via its own env var (FACEBOOK_GRAPH_VERSION, etc.).
 */
export const GRAPH_API_VERSION = "v25.0";
export const GRAPH_API_BASE_URL = "https://graph.facebook.com";
