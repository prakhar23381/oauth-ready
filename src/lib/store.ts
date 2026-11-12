import "server-only";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Redis } from "@upstash/redis";
import { Guide } from "@/lib/schema/guide";

/**
 * Storage for live-generated guides.
 * Upstash Redis when configured (production); local .data/ files otherwise (dev).
 */
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null;

// Serverless file systems are read-only apart from the temp dir. Without Redis, generated guides
// on a deployment last only as long as the instance, so Redis is required for durable share links.
const LOCAL_DIR = process.env.VERCEL ? path.join(os.tmpdir(), "oauth-ready", "generated") : path.join(process.cwd(), ".data", "generated");
export const hasDurableStore = () => !!redis || !process.env.VERCEL;
const key = (slug: string) => `guide:${slug}`;

export async function saveGeneratedGuide(g: Guide): Promise<void> {
  if (redis) {
    await redis.set(key(g.slug), JSON.stringify(g));
    await redis.zadd("guides:recent", { score: Date.now(), member: g.slug });
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
    const files = (await fs.readdir(LOCAL_DIR)).filter((f) => f.endsWith(".json"));
    const guides = await Promise.all(files.map((f) => getGeneratedGuide(f.replace(/\.json$/, ""))));
    return guides.filter((g): g is Guide => g !== null).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).slice(0, limit);
  } catch {
    return [];
  }
}

// ---------- usage limits for live generation (protects the free-tier model and search quotas) ----------

const memory = new Map<string, { count: number; resetAt: number }>();

async function hit(key: string, windowSeconds: number): Promise<number> {
  if (redis) {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, windowSeconds);
    return n;
  }
  const now = Date.now();
  const e = memory.get(key);
  if (!e || e.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return 1;
  }
  return ++e.count;
}

export const LIMITS = { perIpPerHour: Number(process.env.GENERATE_LIMIT_PER_IP ?? 6), globalPerDay: Number(process.env.GENERATE_LIMIT_PER_DAY ?? 40) };

/** Returns an error message when a new research run should be refused, otherwise null. */
export async function checkGenerateLimit(ip: string): Promise<string | null> {
  const day = new Date().toISOString().slice(0, 10);
  try {
    if ((await hit(`limit:ip:${ip}:${Math.floor(Date.now() / 3_600_000)}`, 3600)) > LIMITS.perIpPerHour) return `Limit reached: ${LIMITS.perIpPerHour} live research runs per hour. Library guides remain available.`;
    if ((await hit(`limit:day:${day}`, 86_400)) > LIMITS.globalPerDay) return "The daily limit for live research on this demo has been reached. Library guides remain available.";
  } catch {
    // If the limiter itself fails, allow the run.
  }
  return null;
}
