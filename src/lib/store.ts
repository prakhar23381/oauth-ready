import "server-only";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Redis } from "@upstash/redis";
import { BlobPreconditionFailedError, get as blobGet, list as blobList, put as blobPut } from "@vercel/blob";
import { Guide, isSlug } from "@/lib/schema/guide";

/**
 * Storage for live-generated guides, so every generated guide has a durable share link.
 * Backends, in order of preference:
 *  - Upstash Redis (UPSTASH_REDIS_REST_* or Vercel's KV_REST_API_*)
 *  - Vercel Blob, private store (BLOB_READ_WRITE_TOKEN), used by the deployment
 *  - local files under .data/ in development
 */
const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
const blob = !redis && !!process.env.BLOB_READ_WRITE_TOKEN;

// On a serverless deployment without either store, files last only as long as the instance.
const LOCAL_DIR = process.env.VERCEL ? path.join(os.tmpdir(), "oauth-ready", "generated") : path.join(process.cwd(), ".data", "generated");
export const storeBackend = redis ? "redis" : blob ? "blob" : "file";
/** False on Vercel when neither Redis nor Blob is configured: files there vanish with the instance. */
export const hasDurableStore = () => storeBackend !== "file" || !process.env.VERCEL;
const key = (slug: string) => `guide:${slug}`;
const blobPath = (slug: string) => `guides/${slug}.json`;

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

export async function saveGeneratedGuide(g: Guide): Promise<void> {
  if (!isSlug(g.slug)) throw new Error(`Refusing to store a guide with an invalid slug: ${JSON.stringify(g.slug)}`);
  const json = JSON.stringify(g);
  if (redis) {
    await redis.set(key(g.slug), json);
    await redis.zadd("guides:recent", { score: Date.now(), member: g.slug });
    return;
  }
  if (blob) {
    await blobPut(blobPath(g.slug), json, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });
    return;
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, `${g.slug}.json`), JSON.stringify(g, null, 2));
}

export async function getGeneratedGuide(slug: string): Promise<Guide | null> {
  if (!isSlug(slug)) return null;
  try {
    if (redis) {
      const raw = await redis.get<unknown>(key(slug));
      if (!raw) return null;
      return Guide.parse(typeof raw === "string" ? JSON.parse(raw) : raw);
    }
    if (blob) {
      // Read from origin so a regenerated guide is visible immediately.
      const res = await blobGet(blobPath(slug), { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return null;
      return Guide.parse(JSON.parse(await readStream(res.stream)));
    }
    const raw = await fs.readFile(path.join(LOCAL_DIR, `${slug}.json`), "utf8");
    return Guide.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function listRecentGenerated(limit = 12): Promise<Guide[]> {
  try {
    if (redis) {
      const slugs = await redis.zrange<string[]>("guides:recent", 0, limit - 1, { rev: true });
      const guides = await Promise.all(slugs.map(getGeneratedGuide));
      return guides.filter((g): g is Guide => g !== null);
    }
    if (blob) {
      const { blobs } = await blobList({ prefix: "guides/", limit: 200 });
      const recent = blobs.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt)).slice(0, limit);
      const guides = await Promise.all(recent.map((b) => getGeneratedGuide(b.pathname.replace(/^guides\//, "").replace(/\.json$/, ""))));
      return guides.filter((g): g is Guide => g !== null);
    }
    const files = (await fs.readdir(LOCAL_DIR)).filter((f) => f.endsWith(".json"));
    const guides = await Promise.all(files.map((f) => getGeneratedGuide(f.replace(/\.json$/, ""))));
    return guides.filter((g): g is Guide => g !== null).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).slice(0, limit);
  } catch {
    return [];
  }
}

// ---------- usage limits for live generation (protects the free-tier model and search quotas) ----------

/** Reads a non-negative integer from the environment. Empty, non-numeric or negative values use the default. */
export function envInt(value: string | undefined, fallback: number): number {
  const v = (value ?? "").trim();
  return /^\d+$/.test(v) ? Number(v) : fallback;
}

export const LIMITS = { perIpPerHour: envInt(process.env.GENERATE_LIMIT_PER_IP, 6), globalPerDay: envInt(process.env.GENERATE_LIMIT_PER_DAY, 40) };
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryCount(k: string): number {
  const e = memory.get(k);
  if (!e || e.resetAt <= Date.now()) {
    memory.delete(k);
    return 0;
  }
  return e.count;
}
function memoryAdd(k: string, windowSeconds: number) {
  const now = Date.now();
  const e = memory.get(k);
  if (!e || e.resetAt <= now) memory.set(k, { count: 1, resetAt: now + windowSeconds * 1000 });
  else e.count++;
}

export function log(event: string, fields: Record<string, unknown> = {}, level: "info" | "warn" | "error" = "info") {
  console[level](JSON.stringify({ event, ...fields, at: new Date().toISOString() }));
}

/**
 * Records a run and returns an error message when it should be refused, otherwise null.
 * Two layers: an in-memory counter per instance (always on; it also catches concurrent requests
 * that a list-then-write store cannot), then the durable store (Redis counters or Blob markers).
 * If the durable store fails, the in-memory layer still applies, so the limit never switches off.
 */
type DayCounter = { total: number; ip: Record<string, number> };

/**
 * Shared counter for one day, stored as a single Blob and updated with compare-and-swap:
 * read it with its ETag, write it back only if the ETag still matches, retry on conflict.
 * Concurrent runs on different instances therefore cannot both take the last slot.
 */
async function blobCounterCheck(day: string, ipKey: string, perIp: string, perDay: string): Promise<string | null> {
  const pathname = `limits/${day}.json`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await blobGet(pathname, { access: "private", useCache: false });
    const current: DayCounter = res?.statusCode === 200 ? JSON.parse(await readStream(res.stream)) : { total: 0, ip: {} };
    if ((current.ip[ipKey] ?? 0) >= LIMITS.perIpPerHour) return perIp;
    if (current.total >= LIMITS.globalPerDay) return perDay;
    const next: DayCounter = { total: current.total + 1, ip: { ...current.ip, [ipKey]: (current.ip[ipKey] ?? 0) + 1 } };
    try {
      await blobPut(pathname, JSON.stringify(next), {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
        // Existing counter: only overwrite the version we read. New counter: fail if another instance created it first.
        ...(res ? { ifMatch: res.blob.etag } : { allowOverwrite: false }),
      });
      return null;
    } catch (e) {
      const conflict = e instanceof BlobPreconditionFailedError || /already exists|precondition/i.test((e as Error).message);
      if (!conflict) throw e;
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 80 * (attempt + 1)));
    }
  }
  throw new Error("Rate-limit counter is under heavy contention");
}

export async function checkGenerateLimit(ip: string): Promise<string | null> {
  const day = new Date().toISOString().slice(0, 10);
  const hour = Math.floor(Date.now() / 3_600_000);
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 12);
  const perIp = `Limit reached: ${LIMITS.perIpPerHour} live research runs per hour. Library guides remain available.`;
  const perDay = "The daily limit for live research on this demo has been reached. Library guides remain available.";
  const ipKey = `ip:${ipHash}:${hour}`;
  const dayKey = `day:${day}`;

  // Layer 1: this instance. Count only allowed runs, so refused requests cannot use up the daily budget.
  if (memoryCount(ipKey) >= LIMITS.perIpPerHour) return perIp;
  if (memoryCount(dayKey) >= LIMITS.globalPerDay) return perDay;
  memoryAdd(ipKey, 3600);
  memoryAdd(dayKey, 86_400);

  // Layer 2: shared across instances.
  try {
    if (redis) {
      const rIp = `limit:${ipKey}`;
      const rDay = `limit:${dayKey}`;
      const a = await redis.incr(rIp);
      if (a === 1) await redis.expire(rIp, 3600);
      if (a > LIMITS.perIpPerHour) return perIp; // refused requests never touch the daily counter
      const b = await redis.incr(rDay);
      if (b === 1) await redis.expire(rDay, 86_400);
      if (b > LIMITS.globalPerDay) return perDay;
      return null;
    }
    if (blob) return await blobCounterCheck(day, `${hour}-${ipHash}`, perIp, perDay);
  } catch (e) {
    log("limiter.store_error", { backend: storeBackend, error: (e as Error).message }, "warn");
  }
  return null;
}

if (!hasDurableStore()) {
  log("store.ephemeral", { message: "No Redis or Blob store is configured on Vercel. Live research is disabled until one is." }, "error");
}
