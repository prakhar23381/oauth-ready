import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";

const ENV_KEYS = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN", "BLOB_READ_WRITE_TOKEN", "VERCEL", "GENERATE_LIMIT_PER_IP", "GENERATE_LIMIT_PER_DAY"];
let tmp: string;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.resetModules();
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  tmp = mkdtempSync(path.join(os.tmpdir(), "or-store-"));
  vi.spyOn(process, "cwd").mockReturnValue(tmp);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("@upstash/redis");
  vi.doUnmock("@vercel/blob");
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  rmSync(tmp, { recursive: true, force: true });
});

const sampleGuide = () => JSON.parse(readFileSync(path.join(__dirname, "..", "data", "guides", "github.json"), "utf8"));

describe("file backend (local development)", () => {
  it("saves, reads and lists generated guides; unknown slugs return null", async () => {
    const store = await import("@/lib/store");
    expect(store.storeBackend).toBe("file");
    const g = { ...sampleGuide(), slug: "acme", generator: { kind: "live", by: "test", pipelineVersion: "t" } };
    await store.saveGeneratedGuide(g);
    expect((await store.getGeneratedGuide("acme"))?.appName).toBe("GitHub");
    expect(await store.getGeneratedGuide("missing")).toBeNull();
    expect((await store.listRecentGenerated()).map((x) => x.slug)).toEqual(["acme"]);
  });
  it("does not read outside the store directory for a traversal slug", async () => {
    const store = await import("@/lib/store");
    expect(await store.getGeneratedGuide("../../../etc/passwd")).toBeNull();
  });
});

describe("rate limits", () => {
  it("allows 6 runs per IP per hour by default, refuses the 7th", async () => {
    const { checkGenerateLimit } = await import("@/lib/store");
    const results = [];
    for (let i = 0; i < 7; i++) results.push(await checkGenerateLimit("1.2.3.4"));
    expect(results.slice(0, 6).every((r) => r === null)).toBe(true);
    expect(results[6]).toMatch(/Limit reached/);
  });
  it("falls back to the default when the variable is set but empty (as in .env.example)", async () => {
    process.env.GENERATE_LIMIT_PER_IP = "";
    process.env.GENERATE_LIMIT_PER_DAY = "";
    const { checkGenerateLimit } = await import("@/lib/store");
    expect(await checkGenerateLimit("1.2.3.4")).toBeNull();
  });
  it("parses limit variables strictly (F1)", async () => {
    const { envInt } = await import("@/lib/store");
    expect(envInt(undefined, 6)).toBe(6);
    expect(envInt("", 6)).toBe(6);
    expect(envInt("  ", 6)).toBe(6);
    expect(envInt("abc", 6)).toBe(6);
    expect(envInt("-1", 6)).toBe(6);
    expect(envInt("2.5", 6)).toBe(6);
    expect(envInt("12", 6)).toBe(12);
    expect(envInt("0", 6)).toBe(0); // an explicit 0 disables live research
  });
  it("keeps a limit when the variable is not a number", async () => {
    process.env.GENERATE_LIMIT_PER_IP = "abc";
    const { checkGenerateLimit } = await import("@/lib/store");
    const results = [];
    for (let i = 0; i < 50; i++) results.push(await checkGenerateLimit("1.2.3.4"));
    expect(results.some((r) => r !== null)).toBe(true);
  });

  it("Redis: requests refused for one IP do not use up the global daily budget", async () => {
    const counts = new Map<string, number>();
    vi.doMock("@upstash/redis", () => ({
      Redis: class {
        async incr(k: string) {
          counts.set(k, (counts.get(k) ?? 0) + 1);
          return counts.get(k)!;
        }
        async expire() {
          return 1;
        }
      },
    }));
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "t";
    const { checkGenerateLimit } = await import("@/lib/store");
    for (let i = 0; i < 60; i++) await checkGenerateLimit("6.6.6.6"); // one abusive client
    expect(await checkGenerateLimit("7.7.7.7")).toBeNull(); // a different, legitimate visitor
  });

  it("Blob: concurrent requests across separate instances cannot exceed the per-IP limit (F4)", async () => {
    // A shared fake Blob store with real ETag semantics: put with ifMatch fails if the blob changed.
    const objects = new Map<string, { body: string; etag: string }>();
    let version = 0;
    const latency = () => new Promise((r) => setTimeout(r, Math.random() * 8));
    class BlobPreconditionFailedError extends Error {}
    vi.doMock("@vercel/blob", () => ({
      BlobPreconditionFailedError,
      list: async () => ({ blobs: [] }),
      get: async (p: string) => {
        await latency();
        const o = objects.get(p);
        return o ? { statusCode: 200, stream: new Response(o.body).body, blob: { etag: o.etag } } : null;
      },
      put: async (p: string, body: string, opts: { ifMatch?: string; allowOverwrite?: boolean }) => {
        await latency();
        const o = objects.get(p);
        if (opts.ifMatch !== undefined && o?.etag !== opts.ifMatch) throw new BlobPreconditionFailedError("precondition failed");
        if (opts.ifMatch === undefined && o && !opts.allowOverwrite) throw new Error("This blob already exists");
        objects.set(p, { body, etag: `e${++version}` });
        return {};
      },
    }));
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
    const instanceA = await import("@/lib/store");
    vi.resetModules(); // a second module instance = a second serverless instance with its own memory
    const instanceB = await import("@/lib/store");
    expect(instanceA).not.toBe(instanceB);
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? instanceA : instanceB).checkGenerateLimit("8.8.8.8")));
    expect(results.filter((r) => r === null).length).toBe(6);
  });

  it("Blob: a store failure while saving surfaces as an error", async () => {
    vi.doMock("@vercel/blob", () => ({
      BlobPreconditionFailedError: class extends Error {},
      list: async () => ({ blobs: [] }),
      put: async () => {
        throw new Error("BlobServiceNotAvailable");
      },
      get: async () => null,
    }));
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
    const store = await import("@/lib/store");
    await expect(store.saveGeneratedGuide({ ...sampleGuide(), slug: "x" })).rejects.toThrow();
  });

  it("Blob: a store outage does not silently remove the rate limit", async () => {
    vi.doMock("@vercel/blob", () => ({
      BlobPreconditionFailedError: class extends Error {},
      list: async () => {
        throw new Error("BlobAccessError: invalid token");
      },
      put: async () => {
        throw new Error("BlobAccessError: invalid token");
      },
      get: async () => {
        throw new Error("BlobAccessError: invalid token");
      },
    }));
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_bad";
    const { checkGenerateLimit } = await import("@/lib/store");
    const results = [];
    for (let i = 0; i < 20; i++) results.push(await checkGenerateLimit("9.9.9.9"));
    expect(results.some((r) => r !== null)).toBe(true);
  });
});

describe("configuration on Vercel", () => {
  it("does not fall back to ephemeral instance storage without saying so", async () => {
    process.env.VERCEL = "1";
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = await import("@/lib/store");
    // On Vercel without Redis or Blob, guides would go to the function's temp dir and disappear on the
    // next cold start. The store must report that it is not durable (live research is then refused) and log it.
    expect(store.hasDurableStore()).toBe(false);
    expect(errors.mock.calls.some((c) => String(c[0]).includes("store.ephemeral"))).toBe(true);
  });
  it("reports a durable store locally and when Blob is configured", async () => {
    const local = await import("@/lib/store");
    expect(local.hasDurableStore()).toBe(true);
    vi.resetModules();
    process.env.VERCEL = "1";
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
    expect((await import("@/lib/store")).hasDurableStore()).toBe(true);
  });
});
