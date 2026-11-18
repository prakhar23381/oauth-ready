import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
const reply = (content: string) => json({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
const Out = z.object({ ok: z.boolean() });

beforeEach(() => {
  vi.resetModules();
  process.env.GROQ_API_KEY = "test";
  delete process.env.MISTRAL_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
});
afterEach(() => vi.unstubAllGlobals());

describe("completeJson", () => {
  it("returns validated JSON, tolerating code fences", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply('```json\n{"ok": true}\n```')));
    const { completeJson } = await import("@/lib/agent/llm");
    await expect(completeJson({ label: "t", system: "s", user: "u", schema: Out, maxOut: 100 })).resolves.toEqual({ ok: true });
  });

  it("moves to another model after a 429 on the first", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const model = JSON.parse(init.body as string).model;
        seen.push(model);
        return seen.length === 1 ? new Response("rate limited", { status: 429, headers: { "retry-after": "30" } }) : reply('{"ok": true}');
      }),
    );
    const { completeJson } = await import("@/lib/agent/llm");
    await expect(completeJson({ label: "t", system: "s", user: "u", schema: Out, maxOut: 100 })).resolves.toEqual({ ok: true });
    expect(new Set(seen).size).toBe(2);
  });

  it("asks again when the reply does not match the schema", async () => {
    const f = vi.fn().mockResolvedValueOnce(reply('{"wrong": 1}')).mockResolvedValueOnce(reply('{"ok": false}'));
    vi.stubGlobal("fetch", f);
    const { completeJson } = await import("@/lib/agent/llm");
    await expect(completeJson({ label: "t", system: "s", user: "u", schema: Out, maxOut: 100 })).resolves.toEqual({ ok: false });
    expect(JSON.parse(f.mock.calls[1][1].body).messages[1].content).toMatch(/previous reply was rejected/);
  });

  it("gives up with an error after repeated server errors instead of hanging", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const { completeJson } = await import("@/lib/agent/llm");
    await expect(completeJson({ label: "t", system: "s", user: "u", schema: Out, maxOut: 100 })).rejects.toThrow(/HTTP 500/);
  });

  it("refuses a request too large for every model instead of waiting forever", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { completeJson } = await import("@/lib/agent/llm");
    await expect(completeJson({ label: "t", system: "s", user: "x".repeat(40_000), schema: Out, maxOut: 100 })).rejects.toThrow(/too large/);
  });

  it("does not send the API key anywhere but the provider", async () => {
    const f = vi.fn().mockResolvedValue(reply('{"ok": true}'));
    vi.stubGlobal("fetch", f);
    const { completeJson } = await import("@/lib/agent/llm");
    await completeJson({ label: "t", system: "s", user: "u", schema: Out, maxOut: 100 });
    expect(f.mock.calls[0][0]).toMatch(/^https:\/\/api\.groq\.com\//);
  });
});
