/** Request helpers for API routes. Kept out of route files, which may only export route handlers. */

import { createHash } from "crypto";

/**
 * Only same-origin browser requests may start a run. Cross-site pages could otherwise make their
 * visitors spend this demo's free quotas. A JSON content type forces a CORS preflight, and the
 * Origin and Sec-Fetch-Site headers identify cross-site requests that slip through.
 */
export function crossSiteReason(req: Request): string | null {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return "unsupported_content_type";
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return "cross_site";
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
    try {
      if (new URL(origin).host !== host) return "cross_origin";
    } catch {
      return "bad_origin";
    }
  }
  return null;
}

/**
 * The client address used for per-IP limits. On Vercel, `x-real-ip` and `x-vercel-forwarded-for`
 * are set by the platform, so a client cannot choose them. Elsewhere (local development) the first
 * `x-forwarded-for` entry is used, which a client can spoof; the daily limit still bounds spend.
 */
/** Which headers were present and a short hash of each, for diagnosing the limiter without logging addresses. */
export function ipDiagnostics(req: Request): Record<string, string | null> {
  const h = (v: string | null) => (v ? createHash("sha256").update(v.split(",")[0].trim()).digest("hex").slice(0, 8) : null);
  return { xRealIp: h(req.headers.get("x-real-ip")), xVercelForwardedFor: h(req.headers.get("x-vercel-forwarded-for")), xForwardedFor: h(req.headers.get("x-forwarded-for")), used: h(clientIp(req)) };
}

export function clientIp(req: Request): string {
  const first = (v: string | null) => v?.split(",")[0]?.trim() || null;
  if (process.env.VERCEL) return first(req.headers.get("x-real-ip")) ?? first(req.headers.get("x-vercel-forwarded-for")) ?? first(req.headers.get("x-forwarded-for")) ?? "unknown";
  return first(req.headers.get("x-forwarded-for")) ?? "local";
}
