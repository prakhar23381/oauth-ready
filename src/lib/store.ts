import "server-only";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Redis } from "@upstash/redis";
import { get as blobGet, list as blobList, put as blobPut } from "@vercel/blob";
import { Guide } from "@/lib/schema/guide";

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
const key = (slug: string) => `guide:${slug}`;
const blobPath = (slug: string) => `guides/${slug}.json`;

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

export async function saveGeneratedGuide(g: Guide): Promise<void> {
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

export const LIMITS = { perIpPerHour: Number(process.env.GENERATE_LIMIT_PER_IP ?? 6), globalPerDay: Number(process.env.GENERATE_LIMIT_PER_DAY ?? 40) };
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryHit(k: string, windowSeconds: number): number {
  const now = Date.now();
  const e = memory.get(k);
  if (!e || e.resetAt <= now) {
    memory.set(k, { count: 1, resetAt: now + windowSeconds * 1000 });
    return 1;
  }
  return ++e.count;
}

/**
 * Records a run and returns an error message when it should be refused, otherwise null.
 * Redis: atomic counters. Blob: one marker file per run, counted by prefix. Files: in memory.
 */
export async function checkGenerateLimit(ip: string): Promise<string | null> {
  const day = new Date().toISOString().slice(0, 10);
  const hour = Math.floor(Date.now() / 3_600_000);
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 12);
  const perIp = `Limit reached: ${LIMITS.perIpPerHour} live research runs per hour. Library guides remain available.`;
  const perDay = "The daily limit for live research on this demo has been reached. Library guides remain available.";
  try {
    if (redis) {
      const ipKey = `limit:ip:${ipHash}:${hour}`;
      const dayKey = `limit:day:${day}`;
      const [a, b] = await Promise.all([redis.incr(ipKey), redis.incr(dayKey)]);
      if (a === 1) await redis.expire(ipKey, 3600);
      if (b === 1) await redis.expire(dayKey, 86_400);
      if (a > LIMITS.perIpPerHour) return perIp;
      if (b > LIMITS.globalPerDay) return perDay;
      return null;
    }
    if (blob) {
      const [ipRuns, dayRuns] = await Promise.all([blobList({ prefix: `runs/${day}/${hour}-${ipHash}-`, limit: 100 }), blobList({ prefix: `runs/${day}/`, limit: 1000 })]);
      if (ipRuns.blobs.length >= LIMITS.perIpPerHour) return perIp;
      if (dayRuns.blobs.length >= LIMITS.globalPerDay) return perDay;
      await blobPut(`runs/${day}/${hour}-${ipHash}-${Date.now()}`, "1", { access: "private", addRandomSuffix: true, contentType: "text/plain" });
      return null;
    }
    if (memoryHit(`ip:${ipHash}:${hour}`, 3600) > LIMITS.perIpPerHour) return perIp;
    if (memoryHit(`day:${day}`, 86_400) > LIMITS.globalPerDay) return perDay;
  } catch {
    // If the limiter itself fails, allow the run.
  }
  return null;
}
