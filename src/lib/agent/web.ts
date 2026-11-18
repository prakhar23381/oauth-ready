import { lookup } from "node:dns/promises";
import { PublicError } from "./events";
import net from "node:net";

export type SearchResult = { url: string; title: string; content: string; raw?: string; score: number };

export async function tavilySearch(query: string, opts: { maxResults?: number; raw?: boolean } = {}): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new PublicError("Live research is not configured on this deployment (no search key).");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ query, max_results: opts.maxResults ?? 4, include_raw_content: opts.raw ?? false, search_depth: "basic" }),
  });
  if (!res.ok) throw new PublicError(`Search failed (HTTP ${res.status}). Web search is unavailable right now; try again shortly.`);
  const data = (await res.json()) as { results?: { url: string; title?: string; content?: string; raw_content?: string | null; score?: number }[] };
  return (data.results ?? []).map((r) => ({ url: r.url, title: r.title ?? r.url, content: r.content ?? "", raw: r.raw_content ?? undefined, score: r.score ?? 0 }));
}

// ---------- safe fetch (SSRF guard: https only, public addresses only, capped size and time) ----------

function isPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
}

async function assertPublic(u: URL) {
  if (u.protocol !== "https:") throw new Error("Only https URLs are fetched");
  if (net.isIP(u.hostname)) {
    if (isPrivate(u.hostname)) throw new Error("Blocked address");
    return;
  }
  const addrs = await lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error("Blocked address");
}

export type SafeResponse = { status: number; url: string; contentType: string; body: string; location?: string };

export async function safeFetch(url: string, opts: { timeoutMs?: number; maxBytes?: number; followRedirects?: number; accept?: string } = {}): Promise<SafeResponse> {
  let current = new URL(url);
  const max = opts.followRedirects ?? 3;
  for (let hop = 0; ; hop++) {
    await assertPublic(current);
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 7000),
      headers: { "user-agent": "OAuthReadyBot/0.1 (research agent)", accept: opts.accept ?? "text/html,application/json;q=0.9,*/*;q=0.5", "accept-language": "en-US,en;q=0.9" },
    });
    const location = res.headers.get("location") ?? undefined;
    if (res.status >= 300 && res.status < 400 && location && hop < max) {
      current = new URL(location, current);
      continue;
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    const cap = opts.maxBytes ?? 1_500_000;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        chunks.push(value);
        if (size >= cap) {
          await reader.cancel();
          break;
        }
      }
    }
    return { status: res.status, url: current.toString(), contentType: res.headers.get("content-type") ?? "", body: Buffer.concat(chunks).toString("utf8"), location };
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br|table|ul|ol|pre|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[ \t\r\f]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function fetchPageText(url: string): Promise<string> {
  const r = await safeFetch(url);
  if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
  return /html/i.test(r.contentType) || /^\s*</.test(r.body) ? htmlToText(r.body) : r.body;
}

// ---------- excerpts: give the model only the parts of a page that matter ----------

const KEYWORDS =
  /\b(review|approv|verif|production|publish|submit|scope|redirect|callback|limit|quota|rate.?limit|users?\b|athletes?|testers?|business|company|partner|marketplace|app store|pricing|paid|free|tier|plan\b|fee|token|refresh|expir|client.?(id|secret)|oauth|pkce|sandbox|development mode|dev mode|test mode|security assessment|privacy policy|terms|screencast|video|demo|days?\b|weeks?\b|months?\b|hours?\b|machine learning|\bAI\b|train|reject|denied|support|contact|register|create an? app|developer (portal|console|account|program))/gi;

export function excerpt(text: string, budgetChars: number): string {
  // Long lines (pages extracted without line breaks) are split at sentence ends so that every part
  // of the page can compete for the budget, not just its first 1,100 characters.
  const paras = text
    .split(/\n+/)
    .flatMap((p) => (p.length > 1000 ? p.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/) : [p]))
    .map((p) => p.trim())
    .filter((p) => p.length > 30);
  const chunks: { i: number; text: string; score: number }[] = [];
  let buf = "";
  for (const p of paras) {
    buf = buf ? `${buf}\n${p}` : p;
    if (buf.length >= 500) {
      chunks.push({ i: chunks.length, text: buf.slice(0, 1100), score: 0 });
      buf = "";
    }
  }
  if (buf) chunks.push({ i: chunks.length, text: buf.slice(0, 1100), score: 0 });
  for (const c of chunks) {
    const hits = c.text.match(KEYWORDS)?.length ?? 0;
    const numbers = c.text.match(/\b\d+\s*(business\s+)?(days?|weeks?|months?|hours?|users?|requests?|minutes?)\b/gi)?.length ?? 0;
    c.score = (hits + numbers * 3) / Math.sqrt(c.text.length / 500);
  }
  const picked: typeof chunks = [];
  let used = 0;
  for (const c of [...chunks].sort((a, b) => b.score - a.score)) {
    if (used + c.text.length > budgetChars) continue;
    picked.push(c);
    used += c.text.length;
  }
  return picked.sort((a, b) => a.i - b.i).map((c) => c.text).join("\n[…]\n");
}

// ---------- quote verification ----------

const stripLinks = (s: string) => s.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
const norm = (s: string) => stripLinks(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[*_`#>\[\]()|\\]/g, " ").replace(/\s+/g, " ").trim();
const bare = (s: string) => stripLinks(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
const words = (s: string) => stripLinks(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ");

/**
 * True when the quote appears in the page text. Matching ignores case, whitespace, markdown and
 * punctuation. A quote with an ellipsis must match on each side of it. As a last step, a quote
 * passes if at least 85% of its five-word sequences occur in the page, which tolerates a dropped
 * or altered word but not a paraphrase.
 */
export function quoteInText(quote: string, text: string): boolean {
  const parts = quote.split(/\s*(?:…|\.\.\.)\s*/).filter((p) => bare(p).length >= 12);
  if (!parts.length) return false;
  const nt = norm(text);
  const bt = bare(text);
  if (parts.every((p) => nt.includes(norm(p)) || bt.includes(bare(p)))) return true;
  const qw = words(quote);
  if (qw.length < 8) return false;
  const tw = words(text);
  const grams = new Set<string>();
  for (let k = 0; k + 5 <= tw.length; k++) grams.add(tw.slice(k, k + 5).join(" "));
  let hit = 0;
  const total = qw.length - 4;
  for (let k = 0; k + 5 <= qw.length; k++) if (grams.has(qw.slice(k, k + 5).join(" "))) hit++;
  return hit / total >= 0.85;
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
