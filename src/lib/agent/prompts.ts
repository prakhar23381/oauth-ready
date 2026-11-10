import { z } from "zod";
import { Owner, Phase, TimeUnit } from "@/lib/schema/guide";

export const TOPICS = {
  account: "developer account: cost, who can register, company or identity requirements",
  app_types: "kinds of app or credential offered and which one to choose",
  create_app: "where and how an OAuth app is created (console, form fields, manifest, CLI, API)",
  redirect_uri: "redirect URI rules (https, localhost, wildcards, number allowed)",
  scopes: "scopes or permissions, and which ones are sensitive or need approval",
  dev_limits: "limits before approval: user caps, test users, sandbox or development mode, warning screens",
  review_process: "what triggers a review, verification or approval, and how it is submitted",
  review_requirements: "what must be provided for review: privacy policy, video, domain, test account, security assessment",
  review_timeline: "how long review or approval takes, officially or as reported by developers",
  business_gate: "business verification, partner programme, usage thresholds or contracts required",
  pricing: "fees, paid API tiers or assessment costs",
  tokens: "access and refresh token lifetimes, rotation, offline access, PKCE",
  rate_limits: "API rate limits or quotas, especially per app or per user",
  ai_policy: "rules on AI, machine learning, model training or automated agents using the data",
  rejection: "common reasons for rejection and how to resolve them",
  support: "support or escalation channels for developers",
} as const;
export type Topic = keyof typeof TOPICS;
export const CRITICAL_TOPICS: Topic[] = ["create_app", "dev_limits", "review_process", "review_timeline", "tokens"];

const STYLE = `Style: professional and neutral, as in technical documentation. State facts directly. No slang, idiom, exclamation marks or first person. Keep every field as short as accuracy allows.`;

// ---------- 1. identify ----------
export const ResolveOut = z.object({
  appName: z.string().min(1),
  website: z.string().min(3),
  category: z.string().optional(),
  officialDomains: z.array(z.string()).default([]),
  oauth: z.enum(["yes", "no", "unclear"]).catch("unclear"),
  authNote: z.string().default(""),
  queries: z.array(z.string().min(4)).min(3).max(7),
});
export const RESOLVE_SYSTEM = `You plan research for a guide on registering an OAuth app with a software provider and getting it approved for production use.
Given a user's query (an app name or website) and a few search results, identify the provider and plan the searches.
Reply with one JSON object:
{"appName": canonical product name, "website": main https URL, "category": short category, "officialDomains": [domains the provider itself controls, including developer docs and help-centre domains, without https://], "oauth": "yes" | "no" | "unclear" (does it offer OAuth 2.0 for third-party apps), "authNote": one sentence on how third-party apps authenticate, "queries": [5 or 6 web search queries]}
The queries must together cover: creating the OAuth app (developer console, redirect URIs, scopes); app review, verification or production approval requirements; limits before approval (user caps, development mode, quotas, rate limits); token lifetimes and refresh; partner, business or pricing requirements; and one query for developer reports of how long approval takes. Include the product name and the current year where useful.`;

// ---------- 2. extract ----------
export const FactsOut = z.object({
  facts: z.array(z.object({ topic: z.string(), claim: z.string().min(8), quote: z.string().default(""), source: z.string() })).default([]),
});
export const extractSystem = (appName: string) => `You extract evidence for a guide on registering an OAuth app with ${appName} and getting it approved for production.
You are given excerpts from web pages, each labelled with a source id (S1, S2, ...).
Reply with one JSON object: {"facts": [{"topic": one of the topic keys below, "claim": one specific, checkable statement in your own words (max 30 words), "quote": one contiguous sentence copied character for character from that source (max 240 characters, no ellipsis), "source": the source id}]}
Rules:
- Return up to 10 facts, the most decision-relevant first. Do not state the same fact twice. Prefer concrete numbers: limits, durations, prices, counts.
- Use only what the excerpts state. Do not use prior knowledge. If an excerpt has nothing relevant, return no facts for it.
- Each fact must be about ${appName}'s developer platform, not another product. Skip general product limits (records, seats, storage) that do not affect an OAuth integration.
- For developer reports (forums, blogs), begin the claim with "Reported:".
Topic keys:
${Object.entries(TOPICS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`;

// ---------- 3. follow-up ----------
export const GapOut = z.object({ queries: z.array(z.string().min(4)).max(3).default([]) });
export const GAP_SYSTEM = `You review research coverage for a guide on registering an OAuth app with a provider and getting it approved for production.
Given the facts found so far, decide whether important gaps remain in: review or approval process and its timeline, limits before approval, review requirements, token lifetimes, AI or data-use policy, fees.
Reply with one JSON object: {"queries": [up to 3 specific web search queries that would fill the most important gaps]}. Return an empty list if coverage is adequate. Do not repeat earlier queries.`;

// ---------- 4. write ----------
const R = z.object({
  min: z.coerce.number().nonnegative().catch(0),
  max: z.coerce.number().nonnegative().catch(0),
  unit: TimeUnit.catch("days"),
  basis: z.string().catch("Estimate. No direct source."),
});
const strings = z.array(z.string()).default([]).catch([]);

export const PlanOut = z.object({
  summary: z.string(),
  headline: z.string(),
  biggestRisk: z.string(),
  verdictFacts: strings,
  paths: z
    .array(
      z.object({
        name: z.string(),
        whenThisApplies: z.string(),
        isDefault: z.boolean().catch(false),
        tier: z.coerce.number().int().min(1).max(4).catch(2),
        firstLogin: R,
        activeEffort: R,
        waitTime: R,
        production: R,
        cost: z.string().nullish(),
        steps: z
          .array(
            z.object({
              phase: Phase.catch("configure"),
              owner: Owner.catch("you"),
              title: z.string(),
              detail: z.string(),
              est: R.nullish().catch(null),
              gotchas: strings,
              facts: strings,
              sources: strings,
            }),
          )
          .min(1),
      }),
    )
    .min(1)
    .max(3),
});
const RANGE = `{"min": number, "max": number, "unit": "minutes"|"hours"|"days"|"weeks"|"months", "basis": where the estimate comes from, citing fact ids, or "Estimate. No direct source."}`;
export const PLAN_SYSTEM = `You write the setup plan of a guide that tells a developer how long and how hard it is to register an OAuth app with a provider and get it approved so that real end users can connect.
You are given numbered facts (F1, F2, ...) with their evidence grade, live endpoint checks, and a list of sources (S1, S2, ...).
${STYLE}
Reply with one JSON object:
{"summary": two sentences, "headline": about the default path only, as two short sentences in the form "Testing is available within <time>. <Production access for X> requires <time> and <what drives it>." Do not put numbers in brackets, "biggestRisk": one sentence, "verdictFacts": [fact ids supporting the headline],
 "paths": [1 to 3 paths. A path is a distinct route whose effort differs because of scopes, audience or app type, for example internal use versus public distribution. Mark exactly one "isDefault": true: the path that lets end users outside the developer's own organisation connect (public or distributed app). Internal, private, sandbox or single-user paths are never the default unless no public route exists. List the default path first.
   {"name": short noun phrase in sentence case, "whenThisApplies": one sentence, "isDefault": boolean,
    "tier": 1 (self-serve, no provider review) | 2 (light review or listing, usually days) | 3 (formal review or security assessment, usually weeks) | 4 (gated by business status, partner programme, usage threshold or paid tier),
    "firstLogin": ${RANGE} (time to a first working test connection), "activeEffort": range (the developer's own work), "waitTime": range (waiting on the provider; 0 if none), "production": range (total until any end user can connect),
    "cost": fees as a short phrase, or null,
    "steps": [3 to 7 steps in order: {"phase": "account"|"create"|"configure"|"test"|"review"|"wait"|"launch", "owner": "you" (needs the developer's account or decision) | "agent" (an AI agent can draft or prepare it: scope selection, form text, justifications, manifests) | "provider" (waiting for review), "title": imperative, max 9 words, "detail": max 35 words, "est": range or null, "gotchas": [0 to 2 short warnings], "facts": [fact ids supporting this step], "sources": [0 to 2 source ids worth opening]}]}]}
Rules:
- Use only the facts provided for provider-specific statements. General OAuth practice may be used for step wording. Never invent limits, durations, prices or URLs.
- At least one step in a path with a review should have owner "agent" where drafting or preparation is involved (scope selection, listing or justification text, review submission notes).
- Durations must come from the facts. Where the facts give none, use a cautious range and say so in "basis".
- Facts graded "community" or "unverified" are weaker. Prefer "official" facts, and name the grade in "basis" when relying on weaker ones.
- If the provider offers no OAuth for third-party apps, write one path describing the authentication method that the facts do support.`;

export const DetailsOut = z.object({
  requirements: z.array(z.object({ item: z.string(), detail: z.string().default(""), facts: strings })).default([]).catch([]),
  considerations: z
    .array(z.object({ title: z.string(), detail: z.string(), forAgents: z.boolean().catch(false), severity: z.enum(["info", "warn", "blocker"]).catch("info"), facts: strings }))
    .default([])
    .catch([]),
  troubleshooting: z.array(z.object({ symptom: z.string(), cause: z.string(), fix: z.string(), escalation: z.string().nullish(), facts: strings })).default([]).catch([]),
  unknowns: strings,
});
export const DETAILS_SYSTEM = `You write supporting sections of a guide on registering an OAuth app with a provider and getting it approved for production.
You are given numbered facts (F1, F2, ...) with their evidence grade.
${STYLE}
Reply with one JSON object:
{"requirements": [up to 7 things the developer must have ready, each {"item": noun phrase, max 7 words, "detail": one sentence, "facts": [fact ids]}],
 "considerations": [up to 6 limits or policies that affect setup or operation, each {"title": max 9 words, "detail": one or two sentences, "forAgents": true if it matters particularly to long-running AI agents (token expiry, rate limits, AI or data-use policy), "severity": "blocker" | "warn" | "info", "facts": [fact ids]}],
 "troubleshooting": [up to 4 likely problems, each {"symptom": what the developer observes, "cause": one sentence, "fix": one sentence, "escalation": channel or null, "facts": [fact ids]}],
 "unknowns": [up to 5 important questions the facts do not answer, each one sentence]}
Use only the facts provided. Every requirement and consideration must cite at least one fact id. Omit a section's items if the facts do not support any.`;

const asText = z.preprocess((v) => (typeof v === "string" ? v : JSON.stringify(v, null, 2)), z.string());
export const MaterialsOut = z.object({
  materials: z
    .array(z.object({ kind: z.enum(["form_values", "manifest", "cli", "justification", "checklist", "other"]).catch("other"), title: z.string(), content: asText }))
    .max(4)
    .default([])
    .catch([]),
});
export const MATERIALS_SYSTEM = `You prepare drafts that save a developer time when registering an OAuth app with a provider. The developer is building an AI agent product and connects it through Composio.
You are given numbered facts about the provider.
${STYLE}
Reply with one JSON object: {"materials": [2 to 3 items, each {"kind": "form_values" | "justification" | "manifest" | "cli" | "checklist", "title": max 8 words, "content": plain text, ready to copy}]}
Always include:
1. kind "form_values": the values for the provider's app registration form as "field: value" lines, using placeholders such as <Your product name> and <yourdomain>. Use the redirect URI given in the input.
Include when the facts support it:
2. kind "justification": a draft of the text a reviewer asks for (use case description, scope justification), if the provider has a review.
3. kind "manifest" or "cli": only if the facts state the provider supports creating apps from a manifest, CLI or API.
4. kind "checklist": the minimum scopes to request and why, if the facts list scopes.
Use only the facts provided for provider-specific details. Mark anything to be confirmed with <confirm>.`;
