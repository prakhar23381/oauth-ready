import { createHash } from "crypto";
import { COMPOSIO_CALLBACK_URL, COMPOSIO_DIRECTORY_FETCHED_AT, COMPOSIO_DIRECTORY_SOURCE, lookupComposio } from "@/lib/composio-directory";
import { Guide, type Claim, type GuideInput, type Range } from "@/lib/schema/guide";
import { PublicError, type Emit } from "./events";
import { completeJson, hasLlm, newUsage } from "./llm";
import { probeOAuth, type Probe } from "./probe";
import * as P from "./prompts";
import { excerpt, fetchPageText, hostOf, quoteInText, tavilySearch, type SearchResult } from "./web";

export const PIPELINE_VERSION = "0.2";

type Page = { id: string; url: string; title: string; host: string; official: boolean; text: string; excerpt: string };
type Fact = { id: string; topic: string; claim: string; quote: string; page: Page; verified: boolean };

/**
 * URL-safe slug. Names with no Latin letters or digits (for example 微信) get a short hash, so
 * different apps never share a slug and overwrite each other's guide.
 */
export const slugify = (s: string) => {
  const base = s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/, "");
  if (base) return base;
  const hash = createHash("sha256").update(s.trim().normalize("NFC")).digest("hex").slice(0, 10);
  return `app-${hash}`;
};
const cleanDomain = (d: string) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
const cleanUrl = (u: string) => u.split("#")[0].replace(/\/$/, "");
const bare = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const today = () => new Date().toISOString().slice(0, 10);

export type Generated = { guide: Guide; ms: number };

/**
 * The research agent. Stages: identify → search → read → follow up → write → verify.
 * Every provider-specific statement in the result traces to a fact with a quote from a fetched page,
 * and each quote is checked against that page's text before the guide is saved.
 */
export async function researchGuide(query: string, emit: Emit): Promise<Generated> {
  if (!hasLlm()) throw new PublicError("No model API key is configured, so live research is unavailable on this deployment.");
  const started = Date.now();
  const usage = newUsage();

  // ---------- 1. identify ----------
  emit({ type: "stage", stage: "identify", status: "start" });
  const firstQuery = `${query} developer API OAuth 2.0 create app`;
  emit({ type: "search", query: firstQuery });
  const first = await tavilySearch(firstQuery, { maxResults: 5 });
  const hint = lookupComposio(query);
  const plan = await completeJson(
    {
      label: "identify",
      system: P.RESOLVE_SYSTEM,
      user: `Query: ${query}\nYear: ${new Date().getFullYear()}\nSearch results:\n${first.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content.slice(0, 220)}`).join("\n")}`,
      schema: P.ResolveOut,
      maxOut: 500,
      prefer: "fast",
      emit,
    },
    usage,
  );
  if (!plan.found || !plan.appName || !plan.website || plan.queries.length < 3) throw new PublicError(`"${query}" could not be matched to a software product. Check the spelling, or enter the product's website.`);
  const website = plan.website.startsWith("http") ? plan.website : `https://${plan.website}`;
  const official = [...new Set([cleanDomain(website), ...plan.officialDomains.map(cleanDomain)].filter((d) => d.includes(".")))];
  // A provider's own forum holds user reports, not documentation, so it is graded as community evidence.
  const isForum = (host: string) => /(^|\.)(community|communityhub|forum|forums|discuss|discourse|answers|support-forum|groups)\./.test(`${host}.`) || /stackoverflow|reddit|stackexchange|quora/.test(host);
  const isOfficial = (host: string) => !isForum(host) && official.some((d) => host === d || host.endsWith(`.${d}`) || d.endsWith(`.${host}`));
  // Drop search results that are not about this provider at all.
  const nameTokens = plan.appName.toLowerCase().replace(/\(.*?\)/g, "").split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const relevant = (r: SearchResult) => isOfficial(hostOf(r.url)) || nameTokens.some((t) => `${r.title} ${r.url} ${r.content}`.toLowerCase().includes(t));
  emit({ type: "stage", stage: "identify", status: "done", note: `${plan.appName} · ${official.slice(0, 3).join(", ")}` });

  const probesPromise: Promise<Probe[]> = probeOAuth(official, emit).catch(() => []);

  // ---------- 2. search ----------
  emit({ type: "stage", stage: "search", status: "start" });
  const used = new Set<string>();
  const pages: Page[] = [];

  async function search(queries: string[]): Promise<SearchResult[]> {
    queries.forEach((q) => emit({ type: "search", query: q }));
    const batches = await Promise.all(queries.map((q) => tavilySearch(q, { maxResults: 4, raw: true }).catch(() => [] as SearchResult[])));
    const seen = new Set<string>();
    return batches.flat().filter((r) => {
      const u = cleanUrl(r.url);
      if (seen.has(u) || used.has(u) || /\.(pdf|zip|png|jpg)$/i.test(u) || !relevant(r)) return false;
      seen.add(u);
      return true;
    });
  }

  async function load(results: SearchResult[], maxOfficial: number, maxOther: number): Promise<Page[]> {
    const rank = (r: SearchResult) => r.score + (r.raw && r.raw.length > 800 ? 0.15 : 0);
    const off = results.filter((r) => isOfficial(hostOf(r.url))).sort((a, b) => rank(b) - rank(a));
    const other = results.filter((r) => !isOfficial(hostOf(r.url))).sort((a, b) => rank(b) - rank(a));
    const chosen = [...off.slice(0, maxOfficial + Math.max(0, maxOther - other.length)), ...other.slice(0, maxOther + Math.max(0, maxOfficial - off.length))];
    const loaded = await Promise.all(
      chosen.map(async (r) => {
        let text = r.raw ?? "";
        if (text.length < 600) text = await fetchPageText(r.url).catch(() => r.content);
        text = text.slice(0, 90_000);
        if (text.length < 300) return null;
        return { url: r.url, title: r.title.slice(0, 90), host: hostOf(r.url), official: isOfficial(hostOf(r.url)), text, excerpt: excerpt(text, 4200) };
      }),
    );
    const out: Page[] = [];
    for (const p of loaded) {
      if (!p) continue;
      used.add(cleanUrl(p.url));
      const page = { ...p, id: `S${pages.length + 1}` };
      pages.push(page);
      out.push(page);
      emit({ type: "source", url: page.url, title: page.title, official: page.official });
    }
    return out;
  }

  const round1 = await load(await search(plan.queries.slice(0, 6)), 6, 3);
  emit({ type: "stage", stage: "search", status: "done", note: `${round1.length} pages` });
  if (!round1.length) throw new PublicError(`No readable sources were found for "${query}".`);

  // ---------- 3. read ----------
  const facts: Fact[] = [];
  const factKeys = new Set<string>();

  async function extract(batch: Page[]) {
    const groups: Page[][] = [];
    const size = batch.length <= 4 ? 2 : 3;
    for (let i = 0; i < batch.length; i += size) groups.push(batch.slice(i, i + size));
    const results = await Promise.allSettled(
      groups.map((g) =>
        completeJson(
          {
            label: "read",
            system: P.extractSystem(plan.appName),
            user: g.map((p) => `### ${p.id} (${p.official ? "official" : "third party"}) ${p.title}\n${p.url}\n${p.excerpt}`).join("\n\n"),
            schema: P.FactsOut,
            maxOut: 1500,
            prefer: "strong",
            emit,
          },
          usage,
        ),
      ),
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const f of r.value.facts) {
        const page = pages.find((p) => p.id === f.source.trim().toUpperCase());
        if (!page || !(f.topic in P.TOPICS)) continue;
        const key = bare(f.claim).slice(0, 70);
        const quoteKey = f.quote.length > 20 ? `q:${bare(f.quote).slice(0, 90)}` : key;
        if (factKeys.has(key) || factKeys.has(quoteKey) || facts.length >= 44) continue;
        factKeys.add(key);
        factKeys.add(quoteKey);
        const fact: Fact = { id: `F${facts.length + 1}`, topic: f.topic, claim: f.claim.trim(), quote: f.quote.trim(), page, verified: quoteInText(f.quote, page.text) };
        facts.push(fact);
        emit({ type: "fact", topic: fact.topic, claim: fact.claim, url: page.url });
      }
    }
  }

  emit({ type: "stage", stage: "read", status: "start" });
  await extract(round1);
  emit({ type: "stage", stage: "read", status: "done", note: `${facts.length} facts` });

  // ---------- 4. follow up on gaps ----------
  emit({ type: "stage", stage: "followup", status: "start" });
  const covered = (t: string) => facts.filter((f) => f.topic === t).length;
  try {
    const gap = await completeJson(
      {
        label: "followup",
        system: P.GAP_SYSTEM,
        user: `Provider: ${plan.appName}\nEarlier queries:\n${plan.queries.map((q) => `- ${q}`).join("\n")}\nFacts per topic: ${Object.keys(P.TOPICS).map((t) => `${t}=${covered(t)}`).join(", ")}\nFacts so far:\n${facts.map((f) => `- [${f.topic}] ${f.claim}`).join("\n")}`,
        schema: P.GapOut,
        maxOut: 300,
        prefer: "fast",
        emit,
      },
      usage,
    );
    if (gap.queries.length) {
      const round2 = await load(await search(gap.queries), 3, 2);
      if (round2.length) await extract(round2);
    }
    emit({ type: "stage", stage: "followup", status: "done", note: gap.queries.length ? `${gap.queries.length} more searches · ${facts.length} facts` : "coverage adequate" });
  } catch {
    emit({ type: "stage", stage: "followup", status: "done", note: "skipped" });
  }
  if (facts.length < 3) throw new PublicError(`Too little evidence was found for "${query}" to write a reliable guide.`);

  const probes = await probesPromise;

  // ---------- 5. write ----------
  emit({ type: "stage", stage: "write", status: "start" });
  const grade = (f: Fact) => (!f.verified ? "unverified" : f.page.official ? "official" : "community");
  const factList = facts.map((f) => `${f.id} [${f.topic}|${grade(f)}] ${f.claim}`).join("\n");
  const sourceList = pages.map((p) => `${p.id} ${p.official ? "official" : "third party"} · ${p.title} · ${p.url}`).join("\n");
  const composio = lookupComposio(plan.appName).status !== "not_listed" ? lookupComposio(plan.appName) : hint;
  const context = `Provider: ${plan.appName} (${website})\nOAuth for third-party apps: ${plan.oauth}. ${plan.authNote}\nComposio: ${composio.status === "managed" ? "offers a managed OAuth app for this provider" : composio.status === "bring_your_own" ? "requires the developer's own OAuth app for this provider" : "does not list this provider"}\nLive endpoint checks:\n${probes.map((p) => `- ${p.check}: ${p.result}`).join("\n") || "- none"}`;

  const [planR, detailsR, materialsR] = await Promise.allSettled([
    completeJson({ label: "plan", system: P.PLAN_SYSTEM, user: `${context}\n\nFacts:\n${factList}\n\nSources:\n${sourceList}`, schema: P.PlanOut, maxOut: 3800, prefer: "strong", emit }, usage),
    completeJson({ label: "details", system: P.DETAILS_SYSTEM, user: `${context}\n\nFacts:\n${factList}`, schema: P.DetailsOut, maxOut: 2200, prefer: "strong", emit }, usage),
    completeJson({ label: "materials", system: P.MATERIALS_SYSTEM, user: `${context}\nRedirect URI to register: ${COMPOSIO_CALLBACK_URL}\n\nFacts:\n${factList}`, schema: P.MaterialsOut, maxOut: 1500, prefer: "fast", emit }, usage),
  ]);
  if (planR.status !== "fulfilled") throw new Error(`The guide could not be written: ${String(planR.reason?.message ?? planR.reason).slice(0, 200)}`);
  const plan2 = planR.value;
  const details = detailsR.status === "fulfilled" ? detailsR.value : { requirements: [], considerations: [], troubleshooting: [], unknowns: [] };
  const materials = materialsR.status === "fulfilled" ? materialsR.value.materials : [];
  emit({ type: "stage", stage: "write", status: "done" });

  // ---------- 6. verify and assemble ----------
  emit({ type: "stage", stage: "verify", status: "start" });
  const claims: Claim[] = facts.map((f) => ({
    id: f.id.toLowerCase(),
    text: f.claim,
    status: !f.verified ? "inferred" : f.page.official ? "official_doc" : "community",
    confidence: !f.verified ? "low" : f.page.official ? "high" : "medium",
    sources: [{ url: f.page.url, title: f.page.title, quote: f.quote || undefined }],
    verifiedQuote: f.verified,
    asOf: today(),
  }));
  claims.push({
    id: "composio-callback",
    text: `Composio's redirect URI for custom OAuth apps is ${COMPOSIO_CALLBACK_URL}.`,
    status: "official_doc",
    confidence: "high",
    sources: [{ url: "https://docs.composio.dev/docs/custom-auth-configs", title: "Composio: custom auth configs", quote: COMPOSIO_CALLBACK_URL }],
    asOf: COMPOSIO_DIRECTORY_FETCHED_AT,
  });
  const claimIds = new Set(claims.map((c) => c.id));
  const refs = (ids: string[]) => [...new Set(ids.map((i) => i.trim().toLowerCase()).filter((i) => claimIds.has(i)))];
  // Fact ids are internal. In text shown to readers, replace them with the source's host.
  const factHost = new Map(facts.map((f) => [f.id, f.page.host]));
  const REF = /\b(?:facts?\s+)?F\d+(?:\s*(?:,|and|&)\s*F\d+)*\b/gi;
  const readable = (s: string) => {
    const onlyRefs = s.replace(REF, "").replace(/[\s.,;()]/g, "") === "";
    const out = s.replace(REF, (m) => {
      const hosts = [...new Set((m.match(/F\d+/gi) ?? []).map((id) => factHost.get(id.toUpperCase())).filter(Boolean))];
      return hosts.length ? hosts.join(" and ") : "cited sources";
    });
    return onlyRefs ? `Source: ${out.trim()}` : out;
  };
  const fix = (r: Range): Range => {
    const out = r.min > r.max ? { ...r, min: r.max, max: r.min } : r;
    return { ...out, basis: readable(out.basis) };
  };

  const pathIds = new Set<string>();
  let hasDefault = false;
  const paths = plan2.paths.map((p, pi) => {
    let id = slugify(p.name);
    while (pathIds.has(id)) id += "-2";
    pathIds.add(id);
    const isDefault = p.isDefault && !hasDefault;
    hasDefault ||= isDefault;
    const hasWaitStep = p.steps.some((s) => s.owner === "provider");
    // Consistency: a path with a provider wait cannot be tier 1, and tier 1 has no wait.
    const tier = (p.tier === 1 && (hasWaitStep || p.waitTime.max > 0) ? 2 : p.tier) as 1 | 2 | 3 | 4;
    let injected = false;
    const steps = p.steps.map((s, si) => {
      const addCallback = !injected && (s.phase === "create" || s.phase === "configure");
      injected ||= addCallback;
      return {
        id: `p${pi + 1}s${si + 1}`,
        phase: s.phase,
        title: s.title,
        owner: s.owner,
        detail: s.detail,
        estTime: s.est ? fix(s.est) : undefined,
        links: s.sources.map((sid) => pages.find((pg) => pg.id === sid.trim().toUpperCase())).filter((pg): pg is Page => !!pg).slice(0, 2).map((pg) => ({ label: pg.title.slice(0, 60), url: pg.url })),
        copyValues: addCallback && plan.oauth !== "no" ? [{ label: "Redirect URI to register (Composio callback)", value: COMPOSIO_CALLBACK_URL }] : [],
        gotchas: s.gotchas.slice(0, 2),
        claimIds: [...refs(s.facts), ...(addCallback && plan.oauth !== "no" ? ["composio-callback"] : [])],
      };
    });
    return {
      id,
      name: p.name.charAt(0).toUpperCase() + p.name.slice(1),
      whenThisApplies: p.whenThisApplies,
      isDefault,
      tier,
      timeToFirstLogin: fix(p.firstLogin),
      activeEffort: fix(p.activeEffort),
      waitTime: tier === 1 ? { min: 0, max: 0, unit: "minutes" as const, basis: "No provider review on this path." } : fix(p.waitTime),
      timeToProduction: fix(p.production),
      cost: p.cost ?? undefined,
      steps,
      claimIds: [],
    };
  });
  if (!hasDefault) paths[0].isDefault = true;
  paths.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  const missing = P.CRITICAL_TOPICS.filter((t) => covered(t) === 0).map((t) => `No source was found for: ${P.TOPICS[t]}.`);
  const unverified = facts.filter((f) => !f.verified).length;
  const composioNote =
    composio.status === "managed"
      ? `Composio provides a managed OAuth app for ${composio.toolkitName}, so development can start without registering your own. A custom OAuth app is needed for your own branding on the consent screen, dedicated quota, or scopes beyond Composio's defaults.`
      : composio.status === "bring_your_own"
        ? `Composio lists ${composio.toolkitName} as requiring your own OAuth app. Register the app with the provider, then add its client ID and secret to a Composio auth config.`
        : `${plan.appName} was not found in Composio's managed-auth directory (checked ${COMPOSIO_DIRECTORY_FETCHED_AT}). A custom integration would need your own OAuth app.`;

  const draft: GuideInput = {
    slug: slugify(plan.appName),
    appName: plan.appName,
    website,
    logoUrl: `https://www.google.com/s2/favicons?domain=${cleanDomain(website)}&sz=64`,
    category: plan.category,
    oauthSupported: plan.oauth !== "no",
    oauthNotes: plan.authNote || undefined,
    generatedAt: today(),
    generator: { kind: "live", by: [...usage.models].join(", "), pipelineVersion: PIPELINE_VERSION, durationMs: Date.now() - started },
    composio: { status: composio.status, toolkitName: "toolkitName" in composio ? composio.toolkitName : undefined, note: composioNote, setupGuideUrl: composio.status === "not_listed" ? undefined : "https://composio.dev/auth" },
    summary: plan2.summary,
    verdict: { headline: plan2.headline, biggestRisk: plan2.biggestRisk, claimIds: refs(plan2.verdictFacts) },
    paths,
    requirements: details.requirements.map((r) => ({ item: r.item, detail: r.detail, requiredFor: ["all"], claimIds: refs(r.facts) })),
    nuances: details.considerations.map((n) => ({ title: n.title, detail: n.detail, forAgents: n.forAgents, severity: n.severity, claimIds: refs(n.facts) })),
    blockers: details.troubleshooting.map((b) => ({ symptom: b.symptom, cause: b.cause, fix: b.fix, escalation: b.escalation ?? undefined, claimIds: refs(b.facts) })),
    handoffKit: [
      ...materials.map((m) => ({ kind: m.kind, title: m.title, content: m.content })),
      ...(plan.oauth !== "no"
        ? [
            {
              kind: "composio_config" as const,
              title: "Connect the OAuth app to Composio",
              content: `1. In the Composio dashboard, open Auth Configs and create one for ${plan.appName} using OAuth2 with your own developer credentials.\n2. Enter the client ID and client secret. Set the redirect URI to ${COMPOSIO_CALLBACK_URL}\n3. Pass the auth config ID (ac_...) in your session's authConfigs, keyed by toolkit. Creating the auth config alone does not apply it.\nReference: https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app`,
            },
          ]
        : []),
    ],
    probes,
    claims,
    unknowns: [...new Set([...details.unknowns.slice(0, 5), ...missing, ...(unverified ? [`${unverified} of ${facts.length} extracted quotes could not be matched to their source page and are marked as unverified.`] : [])])],
    sources: [
      ...pages.filter((p) => facts.some((f) => f.page.id === p.id)).map((p) => ({ url: p.url, title: p.title, kind: p.official ? ("official" as const) : ("community" as const), fetchedAt: today() })),
      { url: COMPOSIO_DIRECTORY_SOURCE, title: "Composio: managed OAuth app directory", kind: "composio" as const, fetchedAt: COMPOSIO_DIRECTORY_FETCHED_AT },
    ],
  };
  const guide = Guide.parse(draft);
  emit({ type: "stage", stage: "verify", status: "done", note: `${facts.length - unverified}/${facts.length} quotes matched · ${usage.calls} model calls · ${usage.inputTokens + usage.outputTokens} tokens` });
  return { guide, ms: Date.now() - started };
}

