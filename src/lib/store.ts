import "server-only";
import { promises as fs } from "fs";
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

const LOCAL_DIR = path.join(process.cwd(), ".data", "generated");
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
