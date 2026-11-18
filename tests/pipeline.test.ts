import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentEvent } from "@/lib/agent/events";

vi.mock("@/lib/agent/probe", () => ({ probeOAuth: async () => [] }));

const OFFICIAL = "https://developer.acme.com/docs/oauth/review";
const FORUM = "https://community.acme.com/t/how-long-is-review/123";
const officialText =
  "Acme OAuth apps. Every new app starts in development mode, limited to 25 users. To serve more users you must submit the app for review. Reviews are completed within 10 business days. Access tokens expire after 2 hours and refresh tokens last 60 days. " +
  "Filler paragraph about the Acme platform and its many integrations. ".repeat(20);
const forumText = "Community thread. My Acme app review took about three weeks in total before approval. " + "Other replies about unrelated topics. ".repeat(30);

type Planner = (system: string, user: string) => unknown;
let plan: Planner;

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  vi.resetModules();
  process.env.MISTRAL_API_KEY = "test"; // large token budget, so the test never waits on rate limits
  process.env.TAVILY_API_KEY = "test";
  delete process.env.GROQ_API_KEY;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("https://api.tavily.com/")) {
        return json({
          results: [
            { url: OFFICIAL, title: "Acme: OAuth app review", content: "review", raw_content: officialText, score: 0.9 },
            { url: FORUM, title: "How long is review?", content: "forum", raw_content: forumText, score: 0.8 },
          ],
        });
      }
      if (url.startsWith("https://api.mistral.ai/")) {
        const body = JSON.parse(init!.body as string);
        const out = plan(body.messages[0].content, body.messages[1].content);
        return json({ choices: [{ message: { content: JSON.stringify(out) } }], usage: { prompt_tokens: 100, completion_tokens: 50 } });
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
  plan = (system) => {
    if (system.startsWith("You plan research"))
      return { found: true, appName: "Acme", website: "https://acme.com", category: "CRM", officialDomains: ["acme.com", "developer.acme.com"], oauth: "yes", authNote: "OAuth 2.0.", queries: ["acme oauth app", "acme app review", "acme token lifetime"] };
    if (system.startsWith("You extract evidence"))
      return {
        facts: [
          { topic: "dev_limits", claim: "New apps are limited to 25 users in development mode.", quote: "Every new app starts in development mode, limited to 25 users.", source: "S1" },
          { topic: "review_timeline", claim: "Reported: review took about three weeks.", quote: "My Acme app review took about three weeks in total before approval.", source: "S2" },
          { topic: "review_timeline", claim: "Reviews finish within 2 days.", quote: "Reviews are always finished within 2 days, guaranteed.", source: "S1" },
          { topic: "tokens", claim: "Fact citing a source that does not exist.", quote: "x", source: "S9" },
          { topic: "not_a_topic", claim: "Fact with an unknown topic key.", quote: "Reviews are completed within 10 business days.", source: "S1" },
        ],
      };
    if (system.startsWith("You review research coverage")) return { queries: [] };
    if (system.startsWith("You write the setup plan"))
      return {
        summary: "s",
        headline: "Testing is available within minutes. Production access requires up to two weeks of review.",
        biggestRisk: "Review delays.",
        verdictFacts: ["F1", "F99"],
        paths: [
          {
            name: "public app",
            whenThisApplies: "Any user.",
            isDefault: true,
            tier: 1, // inconsistent with the provider step below; should be corrected to 2
            firstLogin: { min: 10, max: 20, unit: "minutes", basis: "Estimate." },
            activeEffort: { min: 2, max: 4, unit: "hours", basis: "Estimate." },
            waitTime: { min: 1, max: 2, unit: "weeks", basis: "F3" },
            production: { min: 1, max: 3, unit: "weeks", basis: "Facts F1 and F2 indicate weeks" },
            cost: null,
            steps: [
              { phase: "create", owner: "you", title: "Create the app", detail: "d", est: null, gotchas: [], facts: ["F1"], sources: ["S1"] },
              { phase: "wait", owner: "provider", title: "Wait for review", detail: "d", est: { min: 3, max: 1, unit: "weeks", basis: "F2" }, gotchas: [], facts: ["F2"], sources: ["S9"] },
            ],
          },
        ],
      };
    if (system.startsWith("You write supporting sections")) return { requirements: [{ item: "Privacy policy", detail: "d", facts: ["F1"] }], considerations: [], troubleshooting: [], unknowns: [] };
    if (system.startsWith("You prepare drafts")) return { materials: [{ kind: "form_values", title: "Form", content: { name: "<Your product>" } }] };
    throw new Error("unexpected prompt");
  };
});

async function run(query = "Acme") {
  const events: AgentEvent[] = [];
  const { researchGuide } = await import("@/lib/agent/pipeline");
  const res = await researchGuide(query, (e) => events.push(e));
  return { ...res, events };
}

describe("researchGuide (models and search mocked)", () => {
  it("builds a valid guide and grades evidence by source and quote", async () => {
    const { guide, events } = await run();
    const byText = (t: string) => guide.claims.find((c) => c.text.includes(t))!;
    expect(byText("limited to 25 users").status).toBe("official_doc");
    expect(byText("three weeks").status).toBe("community"); // forum on the provider's own domain
    const invented = byText("within 2 days");
    expect(invented.verifiedQuote).toBe(false);
    expect(invented.status).toBe("inferred");
    expect(guide.claims.some((c) => c.text.includes("does not exist"))).toBe(false); // unknown source id dropped
    expect(guide.claims.some((c) => c.text.includes("unknown topic"))).toBe(false); // unknown topic dropped
    expect(guide.unknowns.join(" ")).toMatch(/1 of 3 extracted quotes/);
    expect(events.at(-1)).toMatchObject({ type: "stage", stage: "verify", status: "done" });
  });

  it("applies consistency rules and keeps internal ids out of reader-facing text", async () => {
    const { guide } = await run();
    const p = guide.paths[0];
    expect(p.tier).toBe(2); // tier 1 with a provider wait is corrected
    expect(p.waitTime.basis).toBe("Source: developer.acme.com");
    expect(p.timeToProduction.basis).not.toMatch(/\bF\d+\b/);
    expect(p.steps[1].estTime).toMatchObject({ min: 1, max: 3 }); // swapped min/max fixed
    expect(guide.verdict.claimIds).toEqual(["f1"]); // unknown F99 dropped
    expect(p.steps[0].copyValues[0].value).toBe("https://backend.composio.dev/api/v3/toolkits/auth/callback");
    expect(p.steps[1].links).toEqual([]); // unknown S9 dropped
    expect(guide.handoffKit[0].content).toContain("<Your product>"); // object content stringified
  });

  it("refuses a query that is not a real product", async () => {
    const prev = plan;
    plan = (system, user) => (system.startsWith("You plan research") ? { found: false } : prev(system, user));
    await expect(run("zxqvbnm")).rejects.toThrow(/could not be matched/);
  });

  it("fails with a clear message when search is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    await expect(run()).rejects.toThrow(/Search failed/);
  });

  it("fails with a clear message when no model key is configured", async () => {
    delete process.env.MISTRAL_API_KEY;
    await expect(run()).rejects.toThrow(/No model API key/);
  });
});
