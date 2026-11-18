import { beforeEach, describe, expect, it, vi } from "vitest";

const research = vi.fn<(query: string, emit: (e: unknown) => void) => Promise<unknown>>();
const limit = vi.fn<(ip: string) => Promise<string | null>>(async () => null);
const saved = vi.fn<(g: unknown) => Promise<void>>(async () => {});
vi.mock("@/lib/agent/pipeline", async (orig) => ({ ...(await orig<typeof import("@/lib/agent/pipeline")>()), researchGuide: (q: string, emit: (e: unknown) => void) => research(q, emit) }));
vi.mock("@/lib/store", () => ({ checkGenerateLimit: (ip: string) => limit(ip), getGeneratedGuide: async () => null, saveGeneratedGuide: (g: unknown) => saved(g), hasDurableStore: () => true, log: () => {} }));

const post = async (body: string, headers: Record<string, string> = { "content-type": "application/json" }) => {
  const { POST } = await import("@/app/api/generate/route");
  return POST(new Request("http://localhost/api/generate", { method: "POST", headers, body }));
};
const events = async (res: Response) => (await res.text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));

beforeEach(() => {
  research.mockReset();
  limit.mockReset().mockResolvedValue(null);
  saved.mockReset();
});

describe("POST /api/generate input handling", () => {
  it.each([
    ["empty body", ""],
    ["invalid JSON", "{not json"],
    ["missing query", "{}"],
    ["one-character query", '{"query":"a"}'],
    ["whitespace query", '{"query":"     "}'],
    ["JSON null", "null"],
    ["numeric query", '{"query":123}'],
    ["array query", '{"query":["slack"]}'],
    ["object query", '{"query":{"$ne":""}}'],
  ])("rejects %s with a 400, not a server error", async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
  });

  it("serves a library guide without research or rate limiting, by name or domain", async () => {
    for (const q of ["Slack", "github.com", "https://www.spotify.com"]) {
      const ev = await events(await post(JSON.stringify({ query: q })));
      expect(ev).toEqual([expect.objectContaining({ type: "done", cached: true })]);
    }
    expect(research).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });

  it("truncates long queries and handles unicode and injection-looking text", async () => {
    research.mockRejectedValue(new Error("stop"));
    for (const q of ["x".repeat(5000), "微信 开放平台", "<script>alert(1)</script>", "'; DROP TABLE guides;--", "../../etc/passwd"]) {
      const ev = await events(await post(JSON.stringify({ query: q })));
      expect(ev.at(-1).type).toBe("error");
    }
    for (const call of research.mock.calls) expect((call[0] as string).length).toBeLessThanOrEqual(80);
  });

  it("returns the limiter's message and does not research when refused", async () => {
    limit.mockResolvedValue("Limit reached");
    const ev = await events(await post('{"query":"Strava"}'));
    expect(ev).toEqual([{ type: "error", message: "Limit reached" }]);
    expect(research).not.toHaveBeenCalled();
  });

  it("does not leak stack traces or secrets in error events", async () => {
    research.mockRejectedValue(new Error("upstream said: invalid api key gsk_abcdefghijklmnopqrstuvwxyz"));
    const ev = await events(await post('{"query":"Strava"}'));
    expect(JSON.stringify(ev)).not.toMatch(/gsk_[a-z]{10,}/);
    expect(JSON.stringify(ev)).not.toMatch(/at .*\.ts:\d+/);
  });

  it("always ends the stream with a done or error event", async () => {
    research.mockImplementation(async (_q: string, emit: (e: unknown) => void) => {
      emit({ type: "stage", stage: "identify", status: "start" });
      throw new TypeError("Cannot read properties of undefined");
    });
    const ev = await events(await post('{"query":"Strava"}'));
    expect(["done", "error"]).toContain(ev.at(-1).type);
  });
});

describe("GET /api/guides/[slug]", () => {
  const get = async (slug: string, qs = "") => {
    const { GET } = await import("@/app/api/guides/[slug]/route");
    return GET(new Request(`http://localhost/api/guides/${encodeURIComponent(slug)}${qs}`), { params: Promise.resolve({ slug }) });
  };
  it("returns JSON and Markdown for a library guide", async () => {
    expect((await (await get("gmail")).json()).slug).toBe("gmail");
    const md = await get("gmail", "?format=md");
    expect(md.headers.get("content-type")).toMatch(/markdown/);
    expect(await md.text()).toMatch(/^# Gmail/);
  });
  it.each(["nope", "../../package", "..%2F..%2Fpackage", "gmail\u0000", "a".repeat(5000)])("returns 404 for %s", async (slug) => {
    expect((await get(slug)).status).toBe(404);
  });
});

describe("POST /api/generate cross-site protection (F12)", () => {
  it("rejects non-JSON content types with 415, so cross-site 'simple requests' cannot start runs", async () => {
    for (const ct of ["text/plain;charset=UTF-8", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
      expect((await post('{"query":"Strava"}', { "content-type": ct })).status).toBe(415);
    }
    expect(research).not.toHaveBeenCalled();
  });
  it("rejects requests from another origin or a cross-site context with 403", async () => {
    expect((await post('{"query":"Strava"}', { "content-type": "application/json", origin: "https://evil.example", host: "localhost" })).status).toBe(403);
    expect((await post('{"query":"Strava"}', { "content-type": "application/json", "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await post('{"query":"Strava"}', { "content-type": "application/json", origin: "null" })).status).toBe(403);
    expect(research).not.toHaveBeenCalled();
  });
  it("accepts same-origin browser requests and non-browser clients", async () => {
    const variants: Record<string, string>[] = [{ origin: "http://localhost", host: "localhost", "sec-fetch-site": "same-origin" }, {}];
    for (const h of variants) {
      const ev = await events(await post('{"query":"Slack"}', { "content-type": "application/json", ...h }));
      expect(ev.at(-1)).toMatchObject({ type: "done", slug: "slack" });
    }
  });
});
