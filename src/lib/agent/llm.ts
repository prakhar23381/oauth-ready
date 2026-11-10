import { z } from "zod";
import type { Emit } from "./events";

/**
 * Minimal OpenAI-compatible JSON client with rate-limit-aware "lanes".
 *
 * Free tiers are small (Groq: 8,000 tokens/minute per model, refilled continuously), so each
 * model is a lane with its own token bucket. Calls go to the best lane that has room, wait when
 * none has, and move to another lane on a 429. Extra providers are added by setting their keys.
 */
type Lane = {
  id: string;
  provider: string;
  url: string;
  key: string;
  model: string;
  extra: Record<string, unknown>;
  strength: number; // 3 = best writer
  limit: number; // tokens per minute
  remaining: number;
  stamp: number;
  blockedUntil: number;
  reasoningPad: number;
};

function buildLanes(): Lane[] {
  const lanes: Lane[] = [];
  const add = (l: Omit<Lane, "remaining" | "stamp" | "blockedUntil">) => lanes.push({ ...l, remaining: l.limit, stamp: Date.now(), blockedUntil: 0 });
  const mistral = process.env.MISTRAL_API_KEY;
  const groq = process.env.GROQ_API_KEY;
  const gemini = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (mistral) {
    const url = "https://api.mistral.ai/v1/chat/completions";
    add({ id: "mistral-large", provider: "mistral", url, key: mistral, model: "mistral-large-latest", extra: {}, strength: 3, limit: 200_000, reasoningPad: 0 });
    add({ id: "mistral-small", provider: "mistral", url, key: mistral, model: "mistral-small-latest", extra: {}, strength: 2, limit: 200_000, reasoningPad: 0 });
  }
  if (groq) {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    add({ id: "groq-gpt-oss-120b", provider: "groq", url, key: groq, model: "openai/gpt-oss-120b", extra: { reasoning_effort: "low" }, strength: 3, limit: 8000, reasoningPad: 500 });
    add({ id: "groq-gpt-oss-20b", provider: "groq", url, key: groq, model: "openai/gpt-oss-20b", extra: { reasoning_effort: "low" }, strength: 2, limit: 8000, reasoningPad: 500 });
    add({ id: "groq-qwen3.8-27b", provider: "groq", url, key: groq, model: "qwen/qwen3.8-27b", extra: { reasoning_effort: "none" }, strength: 1, limit: 8000, reasoningPad: 0 });
  }
  if (gemini) {
    add({ id: "gemini-flash", provider: "google", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: gemini, model: "gemini-flash-latest", extra: {}, strength: 2, limit: 100_000, reasoningPad: 0 });
  }
  return lanes;
}

let LANES: Lane[] | null = null;
const lanes = () => (LANES ??= buildLanes());
export const hasLlm = () => lanes().length > 0;
export const laneSummary = () => lanes().map((l) => l.id).join(", ");

const estTokens = (s: string) => Math.ceil(s.length / 3.5);
const avail = (l: Lane) => Math.min(l.limit, l.remaining + ((Date.now() - l.stamp) * l.limit) / 60_000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function acquire(need: number, prefer: "strong" | "fast", exclude: Set<string>, emit?: Emit): Promise<Lane> {
  let announced = false;
  for (;;) {
    const now = Date.now();
    const fits = lanes().filter((l) => !exclude.has(l.id) && need <= l.limit * 0.95);
    if (!fits.length) throw new Error("Request is too large for every available model");
    const ready = fits
      .filter((l) => l.blockedUntil <= now && avail(l) >= need)
      .sort((a, b) => (prefer === "strong" ? b.strength - a.strength : a.strength - b.strength) || avail(b) - avail(a));
    if (ready[0]) {
      const l = ready[0];
      l.remaining = avail(l) - need;
      l.stamp = Date.now();
      return l;
    }
    const waits = fits.map((l) => Math.max(l.blockedUntil - now, ((need - avail(l)) * 60_000) / l.limit));
    const ms = Math.min(Math.max(250, Math.min(...waits)), 6000);
    if (!announced && ms > 1500) {
      emit?.({ type: "wait", ms: Math.round(Math.min(...waits)), reason: "free-tier rate limit" });
      announced = true;
    }
    await sleep(ms);
  }
}

export type JsonCall<T> = {
  label: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxOut: number;
  prefer?: "strong" | "fast";
  emit?: Emit;
};

export type LlmUsage = { calls: number; inputTokens: number; outputTokens: number; models: Set<string> };
export const newUsage = (): LlmUsage => ({ calls: 0, inputTokens: 0, outputTokens: 0, models: new Set() });

function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error("Model did not return JSON");
  }
}

/** One JSON completion, validated with Zod. Retries on rate limits, other lanes, and one repair pass. */
export async function completeJson<T>(call: JsonCall<T>, usage?: LlmUsage): Promise<T> {
  const exclude = new Set<string>();
  let repairNote = "";
  let lastError = "unknown error";
  for (let attempt = 0; attempt < 5; attempt++) {
    const user = call.user + repairNote;
    const need = estTokens(call.system) + estTokens(user) + Math.round(call.maxOut * 0.7);
    const lane = await acquire(need, call.prefer ?? "strong", exclude, call.emit);
    let res: Response;
    try {
      res = await fetch(lane.url, {
        method: "POST",
        headers: { authorization: `Bearer ${lane.key}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          model: lane.model,
          messages: [
            { role: "system", content: call.system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          [lane.provider === "groq" ? "max_completion_tokens" : "max_tokens"]: call.maxOut + lane.reasoningPad,
          ...lane.extra,
        }),
      });
    } catch (e) {
      lastError = `${lane.id}: ${(e as Error).message}`;
      exclude.add(lane.id);
      if (exclude.size >= lanes().length) exclude.clear();
      continue;
    }
    const rem = Number(res.headers.get("x-ratelimit-remaining-tokens"));
    if (res.headers.has("x-ratelimit-remaining-tokens") && Number.isFinite(rem)) {
      lane.remaining = rem;
      lane.stamp = Date.now();
    }
    if (res.status === 429 || res.status === 503) {
      const retry = Number(res.headers.get("retry-after")) || 6;
      lane.blockedUntil = Date.now() + Math.min(retry, 60) * 1000;
      lane.remaining = 0;
      lane.stamp = Date.now();
      lastError = `${lane.id}: rate limited`;
      continue;
    }
    if (!res.ok) {
      lastError = `${lane.id}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`;
      exclude.add(lane.id);
      if (exclude.size >= lanes().length) exclude.clear();
      continue;
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    if (usage) {
      usage.calls++;
      usage.inputTokens += body.usage?.prompt_tokens ?? 0;
      usage.outputTokens += body.usage?.completion_tokens ?? 0;
      usage.models.add(lane.id);
    }
    try {
      const parsed = call.schema.safeParse(parseJson(body.choices?.[0]?.message?.content ?? ""));
      if (parsed.success) return parsed.data;
      lastError = `${call.label}: schema mismatch: ${parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;
    } catch (e) {
      lastError = `${call.label}: ${(e as Error).message}`;
    }
    repairNote = `\n\nYour previous reply was rejected (${lastError}). Reply again with one valid JSON object in exactly the requested shape.`;
  }
  throw new Error(lastError);
}
