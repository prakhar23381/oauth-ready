# OAuth Ready — Master Plan (Composio APM Integrations take-home)

> **Context recovery:** if you are a fresh session, read this file top to bottom, then [ASSIGNMENT.md](ASSIGNMENT.md) (verbatim brief).
> Then go to **§0 Status board**, find the first unchecked box, and continue from there. Update the status board and the **§12 Decision log** as you work.

- **Date:** 2026-11-11. **Deadline:** submit tonight.
- **Budget:** 6–8 h (brief says this). A focused working slice is enough.
- **Working name:** **OAuth Ready**: "Look up an app, find out how long its OAuth app takes to get ready, and get a plan to do it."
- **Repo root:** `/Users/PrakharSaxena/Documents/Code/Composio`

---

## 0. Status board (keep this current)

**Current phase:** P5 — verification (P0–P4 done; repo: github.com/prakhar23381/oauth-ready, private)

**Blockers / env facts (2026-11-11):**
- LLM keys: the user has no paid key. They create free keys: **GROQ_API_KEY** (console.groq.com), **TAVILY_API_KEY** (tavily.com), optionally **MISTRAL_API_KEY** (console.mistral.ai, phone verification) and **GOOGLE_GENERATIVE_AI_API_KEY** (aistudio.google.com). These go in `.env.local`, later in Vercel env.
- GitHub: repo **github.com/prakhar23381/oauth-ready** (private; make public at submission). `gh` is at `~/.local/bin/gh`.
- Vercel CLI logged in as `prakhar23381-9369`.
- Stack: Next.js 15.5 + React 19 + Tailwind v4 + shadcn/ui, `src/` dir, pnpm, `@anthropic-ai/sdk` 1.8.0, zod 4, tsx.

| Phase | Goal | Timebox | Status |
|---|---|---|---|
| P0 | Scaffold, accounts, keys, repo | 0:20 | ✅ |
| P1 | Domain research → taxonomy, seed apps, Composio facts | 0:40 | ✅ |
| P2 | Guide schema + guide page rendered from a hand-written fixture | 1:15 | ✅ (gmail.json = first library guide) |
| P2.5 | Apply DESIGN.md to the existing UI (fonts, tokens, square, no bold/eyebrows) | 0:30 | ✅ |
| P3 | Live research agent + streaming generation UI | 2:00 | ✅ (Strava 83s, Pipedrive 63s, OpenWeatherMap 40s; nonsense query refused) |
| P4 | Library generation (8–10 apps) + home/library page | 0:45 | ✅ 5 guides: Gmail T3, Slack T3, Outlook T2, GitHub T1, Spotify T4 (cut line used: 5 instead of 8–10) |
| P5 | Verification: hands-on setup attempts + source checks → verification log | 1:15 | ☐ (can overlap P4) |
| P6 | Deploy, share features, polish, guardrails | 0:45 | ☐ |
| P7 | README, demo rehearsal with unfamiliar apps, submit | 0:30 | ☐ |

**Total ≈ 7.5 h.** Cut lines are in §11 if we fall behind.

---

## 1. What the brief actually asks for (requirements checklist)

Source: [ASSIGNMENT.md](ASSIGNMENT.md). Every item must be covered before submission.

**Product**
- [ ] R1: Developer can **look up an app** and get a **guide they can use and share**.
- [ ] R2: Guide tells them **where to start, what to do next**.
- [ ] R3: **How easy or hard** it is to get the OAuth app ready.
- [ ] R4: **Likely time and effort**, *including the wait for approval* (keep active effort and calendar wait separate).
- [ ] R5: **Requirements and nuances** that could affect setup.
- [ ] R6: **What an agent can do for them vs. where they must take over.**
- [ ] R7: **How to proceed when they hit a blocker.**
- [ ] R8: Developer can **submit an app name or website**; an **agent investigates and generates a shareable guide in real time**, including apps not in the library.
- [ ] R9: A **library** pattern exists (target is 100 apps eventually; demo a few **varied** apps).

**Evidence and agents**
- [ ] R10: **Use agents to investigate and attempt as much of the setup as practical**, and let what they find shape the guidance.
- [ ] R11: Be clear about **what was tested, what sources support, and what remains uncertain**.

**Show it works**
- [ ] R12: Demo on **a few real apps with different setup challenges**.
- [ ] R13: Be ready for **an unfamiliar app submitted live**.
- [ ] R14: **Check a sample of guidance against real sources and setup attempts**, and show what was learned, corrected, or could not be verified.
- [ ] R15: Submit a **link to the working experience** and a **source repo**.
- [ ] R16: **README** covering setup instructions, key decisions, and limitations.
- [ ] R17: **No credentials** in the submission.

**What reviewers look for:** understanding of the developer's problem · useful guidance · sound judgment about evidence · thoughtful use of agents.
**Also explicitly valued:** what we learned, the product decisions that follow from it, and a focused scope with a stated reason.

---

## 2. Problem understanding (draft; refine in P1 and reuse in the README)

### 2.1 The objects involved
- **Provider OAuth app** (client ID and secret, registered with Google, Slack, and so on). It identifies *the developer's product* to the provider. The provider shows its name and logo on the consent screen, enforces its redirect URIs and scopes, and attaches the review or verification status to it.
- **Developer's integration** (in Composio this is an *auth config* for a toolkit). It points to an OAuth app: either **Composio-managed** or **the developer's own (bring your own)**.
- **User connection** (Composio *connected account*). One end user authorizes the OAuth app and gets tokens. Many users, one app.
- Consequence: **the app's status limits every user.** Dev or testing mode caps users (Google testing allows 100 test users; Dropbox dev allows 50 users; Spotify dev mode has a small allowlist), shows "unverified app" warnings, and expires tokens early (Google testing-mode refresh tokens expire after 7 days). A developer can't launch to real users until the app is ready.

### 2.2 Composio's managed-auth directory (from docs.composio.dev/toolkits/managed-auth, fetched 2026-11-11)
- 126 toolkits have **Composio-managed OAuth**: the developer can prototype immediately with no OAuth app of their own (Gmail, Slack, GitHub, Notion, HubSpot, Salesforce, Outlook, Dropbox, Zoom, LinkedIn, Instagram, …).
- 275 require **bring your own OAuth app** (Spotify, Twitter, Shopify, Xero, Pipedrive, DocuSign, Webflow, Tiktok, Meta Ads, Google Chat, Microsoft Word, …).
- Check programmatically through the toolkit's `composio_managed_auth_schemes`.
- **Product implication:** a guide must answer "**do I even need my own app yet?**" first. For managed toolkits the answer is: prototype now with Composio's app; you need your own for white-label branding on the consent screen, your own quotas, or scopes and providers Composio doesn't cover. For bring-your-own toolkits, this guide is the critical path.
- ✅ Composio callback URL: `https://backend.composio.dev/api/v3/toolkits/auth/callback` (verified 2026-11-11, docs.composio.dev/docs/custom-auth-configs). Wiring: create auth config with own creds → pass its id in session `authConfigs`. Details in docs/research-notes.md.

### 2.3 Why it's hard (hypotheses for P1 to confirm or refute)
1. **There are two clocks.** "Time to first successful test login" (minutes) and "time until any user can connect" (minutes to months). Docs blur them.
2. **Difficulty depends on what you ask for, not only on the provider.** Google with `openid email` takes days. With `gmail.readonly` (restricted) it needs a CASA security assessment, so weeks and possibly money. **So a guide needs paths (scope or audience tiers), not one difficulty number.**
3. **Hidden gates:** legal entity, business verification (Meta), paid tiers (X API), partner programs (LinkedIn marketing APIs), user caps (Dropbox 50, Spotify), verified domain, privacy policy and ToS URLs, demo video, test credentials for reviewers, admin consent in enterprise tenants (Microsoft), publisher verification.
4. **Agent-builder-specific nuances:** AI and LLM data-use clauses (Google API Services User Data Policy limits on AI training; Slack's 2025 API terms and lower `conversations.history` rate limits for non-Marketplace apps), refresh-token lifetimes for long-running agents, offline access, per-user rate limits.
5. **Docs are scattered and often stale.** Real review timelines exist only in forums. That evidence is labeled as anecdotal.

### 2.4 Focused scope (state this in the README)
> We help an agent builder answer **"How long and how hard until my users can connect app X with my own OAuth app, and what do I do right now?"** for **OAuth 2.0 providers**. We produce a **path-aware, evidence-graded, shareable guide** that separates **active effort from waiting**, says **what an agent can prepare versus what a human must do**, and starts with the **Composio-managed shortcut** where one exists.
> **Out of scope:** completing provider approvals, logging into provider consoles on the user's behalf, non-OAuth auth (API keys are detected and handed off with a short note), and production-grade multi-tenant infrastructure.

---

## 3. Product design

### 3.1 Surfaces (pages)
| Route | Purpose |
|---|---|
| `/` | Hero search box ("App name or website") + **library grid** (logo, difficulty tier, time-to-production badge, Composio-managed badge). Filters: tier, has-review, managed. |
| `/generate?q=…` | **Live agent view**: stage stepper (Identify → Research → Probe → Write → Verify), live feed of searches, pages read, and facts found with source chips. Redirects to the guide when done. |
| `/guides/[slug]` | **The guide** (layout in §3.2). Permalink is the share link. |
| `/verification` | **Verification log**: hands-on attempts, claims checked, corrections, what couldn't be verified. Covers R14. |
| `/about` | Method: evidence grades, how the agent works, limitations. |

### 3.2 Guide page anatomy (one scroll, top = decision, bottom = proof)
1. **Header**: app name, logo, website, "Researched {date} by agent · {n} sources · {k} claims hands-on verified", buttons **Share link / Copy as Markdown / Regenerate**.
2. **Verdict card** (R3, R4):
   - **Difficulty tier**: `1 Self-serve` · `2 Light review` · `3 Formal review/verification` · `4 Gated (partner/paid/business)`.
   - **Time to first test login** (e.g., "~15 min").
   - **Time to production** as a range, split into **active effort** and **waiting** (e.g., "3–5 h of work + 2–6 weeks waiting").
   - **Out-of-pocket cost** if any (e.g., CASA assessment, paid API tier).
   - **Biggest risk**, in one line.
3. **"Do you need your own app yet?"**: the Composio-managed status, and when you'll need your own app.
4. **Pick your path** (paths tabs): e.g., *Internal/testing only*, *Public + basic scopes*, *Public + sensitive/restricted scopes*. Each path has its own tier, time, and step list. *(Core differentiator, see §2.3 #2.)*
5. **Step-by-step plan** (R2, R6): ordered phases (Account → Create app → Configure → Test → Submit review → Wait → Go live). Each step has an **owner chip** (🤖 *Agent can do / prepare* · 👤 *You must do* · ⏳ *Waiting on provider*), an estimated time, a direct link, exact values to paste (redirect URI incl. Composio callback, minimal scope list), and gotchas.
6. **Requirements checklist**: privacy policy URL, ToS, homepage, verified domain, logo, legal entity, demo video, reviewer test account, and so on. Checkboxes persist per viewer in localStorage.
7. **Nuances and gotchas**, with a highlighted *For AI agents* subsection (data-use and AI policies, token lifetimes, rate limits).
8. **If you get stuck** (R7): symptom → likely cause → what to do → where to escalate (support form, forum, partner contact).
9. **Agent handoff kit** (R6, R10): things the agent already prepared, ready to copy:
   - Pre-filled registration fields (name, description, redirect URIs, scopes)
   - **Create-app command or manifest where the provider supports one** (Slack app manifest, `az ad app create` for Microsoft Entra, GitHub App manifest flow)
   - Draft scope-justification text and review submission notes
   - Composio auth-config setup snippet
10. **Evidence and uncertainty** (R11): every claim carries a badge — `Hands-on verified` · `Official docs` (with quote) · `Probe` (live HTTP check) · `Community report` · `Inferred` · `Unknown`. A "**What we couldn't verify**" list. Probe results table. Source list with retrieval dates.

### 3.3 Evidence model (central to "sound judgment about evidence")
- Every factual statement in a guide is a **Claim**: `{ id, text, status, sources[], confidence }`.
- `status` ∈ `hands_on | official_doc | probe | community | inferred | unknown`.
- `official_doc` claims must carry a **verbatim quote** from a page the agent actually fetched. A **deterministic verifier** checks that the quote appears in the captured page text (normalized). If it doesn't, the claim is downgraded to `inferred` and flagged.
- Time estimates are always **ranges** with a basis ("docs say 3–5 business days; forum reports up to 6 weeks").
- Human hands-on results live in an **overlay file** per app (`data/verification/<slug>.json`), merged at render time, so regenerating a guide never erases human verification.

### 3.4 What "agent attempts setup" means here (R10)
Inside the live product (safe, no credentials):
- **Live probes:** fetch `/.well-known/openid-configuration` and `/.well-known/oauth-authorization-server`, and call the authorize endpoint with a dummy `client_id` to confirm it exists and see its error format. Check whether PKCE and dynamic client registration are advertised, whether docs and console URLs resolve (link liveness), and whether the developer-portal signup page is reachable.
- **Pre-filled artifacts:** a manifest, CLI command, form values, or justification text. The agent does the work that can be done without the developer's account.

Offline, by me with agent help during P5:
- **Real setup attempts** on free accounts for 4–5 seed apps (create the app, configure consent, try adding sensitive scopes, read the dev-mode limits in the console). Record outcomes, screenshots (no secrets), and differences from the agent's guide, then feed them back into the guide overlays and the prompt.

---

## 4. Architecture

```
Next.js (App Router, TS, Tailwind, shadcn/ui)  ── deployed on Vercel
│
├─ app/page.tsx                 library + search
├─ app/generate/page.tsx        live progress UI (consumes NDJSON stream)
├─ app/guides/[slug]/page.tsx   guide renderer (server component)
├─ app/verification/page.tsx    verification log
├─ app/api/generate/route.ts    POST {query} → streams NDJSON events; maxDuration=300
├─ app/api/guides/[slug]/route.ts  GET JSON (and ?format=md)
│
├─ lib/schema/guide.ts          Zod schema = single source of truth (render + LLM output + validation)
├─ lib/agent/
│   ├─ pipeline.ts              resolve → research → probe → synthesize → verify → persist
│   ├─ prompts.ts               system prompts + research question bank
│   ├─ tools.ts                 custom tools (probe_oauth, check_links, record_fact)
│   ├─ verify.ts                deterministic quote check, link check, consistency rules
│   └─ events.ts                typed progress events
├─ lib/store.ts                 guides: library JSON files (read-only) + Upstash Redis (generated)
├─ lib/composio-directory.ts    static list: managed vs bring-your-own (from managed-auth page)
├─ data/guides/*.json           library guides (committed)
├─ data/verification/*.json     hands-on overlays (committed)
└─ scripts/gen-library.ts       batch-generate library guides with the same pipeline
```

### 4.1 Key tech choices
| Choice | Pick | Why |
|---|---|---|
| Framework | Next.js 15 + TypeScript | One deploy covers UI, API, and streaming; fast to ship |
| UI | Tailwind + shadcn/ui | Quick and polished |
| LLM | **Free tiers only (no paid key).** Vercel AI SDK (`ai`) with a **provider fallback chain**: Groq (`openai/gpt-oss-120b`, fast, no card) → Mistral free Experiment plan (phone-verified, big token budget) → Gemini AI Studio free key. Picked by env vars; on a 429, try the next provider | The user has no paid key; free limits are low and changing, so no single provider is relied on. Fast models keep the live demo snappy |
| Web tools | **Search:** Tavily free plan (1,000 credits/mo, no card). **Fetch:** our own server-side fetch + HTML→text extraction (free, unlimited); returns only *relevant excerpts* to the model (keyword-window ranking, ~2k tokens per page) and keeps full text for quote verification | Own fetch = no cost, full control, and token-efficient (free tiers cap tokens/day) |
| Structured output | AI SDK `generateObject` with the Zod schema (synthesis call), one repair retry | Provider-agnostic structured output |
| Storage | Library: JSON in repo. Generated: **Upstash Redis** (Vercel Marketplace, free tier); file-store fallback locally | Library is reviewable in git; live guides need a durable share link |
| Streaming | NDJSON over a `ReadableStream` from a Route Handler | Simple; no websockets |
| Hosting | Vercel (Fluid compute, `maxDuration = 300`) | Free and fast. Fallback: Railway/Render if generation takes over 300 s |

### 4.2 Agent pipeline (live generation), target 90–180 s
1. **Resolve** (short call with web_search): canonical name, official domain, developer docs URL, slug. Is OAuth supported? If not, return a short "API key / no OAuth app needed" guide. Look up the Composio directory status.
2. **Research loop** (Opus 5.5, adaptive thinking, effort `medium`→tune). Tools: `web_search` (max_uses ≈ 8), `web_fetch` (max_uses ≈ 12), plus custom tools:
   - `record_fact({ topic, claim, source_url, quote, kind })`: streams each fact to the UI and builds the **evidence ledger**.
   - `probe_oauth({ domain_or_issuer, authorize_url? })`: discovery docs, authorize-endpoint behavior, PKCE flags.
   - `check_links({ urls[] })`: HTTP status.
   - The system prompt includes a **research question bank** (§4.3) and tells the agent to prefer official docs, mark anecdotes as community, and say "unknown" rather than guess.
   - Handle `pause_turn` (server tools) by continuing the loop. Return `is_error` tool results on failures.
3. **Synthesize** (structured-output call): input is the evidence ledger, probe results, and Composio status; output is `Guide` JSON. Each claim references fact IDs. Paths, steps, and owner chips are required fields.
4. **Verify** (deterministic, plus an optional LLM critic): quote ∈ captured fetch text; links alive; consistency rules (for example, "tier 1" can't have a review step; "wait time" must exist if a review step exists). Downgrade or flag claims, then compute verification stats.
5. **Persist** in Redis under the slug (cached; "Regenerate" forces a refresh). Emit a `done` event with the slug.

- Progress events: `stage`, `search`, `fetch`, `fact`, `probe`, `warning`, `done`, `error`. If something fails, still emit a **partial guide** with the unknowns shown, not a blank error page.
- Request hygiene: provider fallback on 429/5xx; hard caps (≤ 8 searches, ≤ 10 fetches, ≤ 14 agent steps); token budget per run (~60–80k) so free daily quotas cover the library plus demo; cache everything (search results, fetched pages, guides) in Redis/file store.
- ☐ P3 first step: check the current Vercel AI SDK docs (tool calling with `stopWhen`, `generateObject`, provider packages `@ai-sdk/groq`, `@ai-sdk/mistral`, `@ai-sdk/google`) and the installed version's types. **Don't guess SDK shapes.**

### 4.3 Research question bank (drives both the prompt and the schema)
1. Developer account: free? Requires a company, legal entity, phone number, or paid plan?
2. App types (e.g., OAuth App vs GitHub App; public vs private/custom app; single vs multi-tenant)?
3. Where and how to create the app (console URL, steps, manifest/CLI/API available?)
4. Redirect URI rules (https only? localhost allowed? wildcards? how many?)
5. Scopes: list, sensitivity tiers, which trigger review
6. Dev/testing-mode limits: user caps, test-user allowlists, token expiry, "unverified" warnings
7. Review or verification: what triggers it, what to submit (privacy policy, video, domain, test account), the process, **official timeline**, **reported timelines**, costs (e.g., CASA), annual re-verification
8. Business verification, partner program, marketplace listing: required or optional, and the benefits (rate limits)
9. Token behavior: access and refresh lifetimes, offline access, refresh-token rotation, PKCE
10. Rate limits relevant to agents; **AI/LLM-specific policy terms**
11. Common rejection reasons and how to fix them; support and escalation channels
12. Composio: managed app available? Callback URL to register for a custom app

---

## 5. Guide schema (Zod; finalize in P2)

```ts
Guide {
  slug, appName, website, logoUrl?, category?,
  generatedAt, generator: { model, pipelineVersion, durationMs, sourcesCount },
  composio: { managedOAuth: boolean | "unknown", toolkitSlug?, note },
  oauthSupported: boolean, oauthNotes?,
  summary: string,                                  // 2–3 sentences, plain words
  verdict: {
    tier: 1|2|3|4, tierLabel, oneLiner, biggestRisk,
    timeToFirstLogin: Range, timeToProduction: Range,
    activeEffort: Range, waitTime: Range, cost?: string,
    claimIds: string[]
  },
  paths: Path[]                                     // ≥1; default path marked
  Path { id, name, whenThisApplies, tier, timeToProduction: Range, activeEffort: Range, waitTime: Range, steps: Step[] }
  Step { id, phase: "account"|"create"|"configure"|"test"|"review"|"wait"|"launch",
         title, owner: "agent"|"you"|"provider", detail, estTime?: Range, links: Link[],
         copyValues?: {label, value}[], gotchas?: string[], claimIds: string[] },
  requirements: { item, requiredFor: pathId[] | "all", detail, claimIds }[],
  nuances: { title, detail, forAgents: boolean, severity: "info"|"warn"|"blocker", claimIds }[],
  blockers: { symptom, cause, fix, escalation?, claimIds }[],
  handoffKit: { kind: "form_values"|"manifest"|"cli"|"justification"|"composio_config"|"other", title, language?, content }[],
  probes: { check, target, result, ok: boolean, at }[],
  claims: Claim[], unknowns: string[], sources: { url, title, fetchedAt, kind }[]
}
Range { min, max, unit: "minutes"|"hours"|"days"|"weeks", basis: string }
Claim { id, text, status: "hands_on"|"official_doc"|"probe"|"community"|"inferred"|"unknown",
        confidence: "high"|"medium"|"low", sources: { url, quote? }[], verifiedQuote?: boolean,
        conflict?: string /* sources disagree: say how */, asOf?: string }
VerificationOverlay { slug, attempts: { date, what, outcome, screenshots?[] }[],
        claimChecks: { claimId|text, agentSaid, finding, result: "confirmed"|"corrected"|"unverifiable", source }[] }
```

---

## 6. Seed library (varied setup challenges; finalize in P1)

| # | App | Expected tier | Challenge it shows | Composio managed? | Hands-on in P5? |
|---|---|---|---|---|---|
| 1 | GitHub | 1 | Instant; OAuth App vs GitHub App choice | Yes | ✅ |
| 2 | Notion | 1–2 | Public integration needs company info and policy URLs | Yes | ✅ |
| 3 | Slack | 2 | Works in own workspace; distribution; Marketplace affects agent rate limits; **manifest = agent artifact** | Yes | ✅ |
| 4 | Google (Gmail) | 3 | Testing caps and 7-day tokens; sensitive vs restricted scopes; brand verification; **CASA** | Yes | ✅ (consent-screen walk-through) |
| 5 | Microsoft (Outlook/Graph) | 2 | Instant Entra registration; publisher verification; admin consent; **`az` CLI artifact** | Yes | optional |
| 6 | Dropbox | 2 | 50-user dev cap → production approval | Yes | optional |
| 7 | Spotify | 4 | Dev-mode user cap; extended quota gated for businesses | No (bring your own) | ✅ (read dashboard limits) |
| 8 | X / Twitter | 4 | Paid API tiers | No (bring your own) | docs only |
| 9 | Xero or Shopify | 2–3 | Bring your own; partner/app-store certification | No (bring your own) | docs only |
| 10 | Meta / Instagram (stretch) | 4 | Business verification + App Review + screencast | Yes | docs only |

**Unfamiliar-app rehearsal set (P7):** Strava, Calendly, Pipedrive, Webflow, Twitch, Canva, plus one obscure app (e.g., Kintone, Clio) and one non-OAuth app to test graceful handling.

---

## 7. Phase details

### P0: Scaffold (0:20)
- [ ] `git init`; `.gitignore` (env files, `.vercel`, node_modules); **never commit secrets**
- [ ] `pnpm create next-app` (TS, Tailwind, App Router, src-less or `src/`, pick one and record it in §12); add shadcn/ui, zod, `@anthropic-ai/sdk`, `@upstash/redis`
- [ ] `.env.example` with `ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `GENERATE_ACCESS_CODE` (optional)
- [ ] Confirm Anthropic credentials (`ant auth status` or API key); create the Vercel project and Upstash DB (can wait until P6)
- [ ] Create the GitHub repo (ask before pushing anything public)
- **Exit:** `pnpm dev` runs; env loads.

### P1: Domain research (0:40)
- [ ] Read Composio docs: managed vs custom auth, auth configs, connected accounts, **custom OAuth callback URL**, `composio_managed_auth_schemes`. Write `docs/research-notes.md`.
- [ ] Build `lib/composio-directory.ts` (managed list from §2.2; slugs from the managed-auth page)
- [ ] Skim official OAuth/verification docs for the 4 hardest seeds (Google, Microsoft, Slack, Spotify) to calibrate the tier rubric and question bank
- [ ] Finalize tier definitions and the seed list (§6)
- **Exit:** research notes + tier rubric + seed list committed; §2 refined.

### P2: Schema + guide UI (1:15)
- [ ] `lib/schema/guide.ts` (Zod) + JSON-schema export for structured output (check SDK zod helper in skill docs)
- [ ] Hand-write **one fixture guide** (Google/Gmail, the richest case) in `data/guides/gmail.json`
- [ ] Build `/guides/[slug]` with all §3.2 sections, path tabs, owner chips, evidence badges, claim popovers (quote + link), requirements checklist (localStorage), copy buttons
- [ ] `?format=md` Markdown export + "Copy as Markdown"
- **Exit:** fixture renders well on desktop and mobile; validates against the schema.

### P3: Agent pipeline + live UI (2:00), the critical path
- [ ] Read claude-api TS docs (README, tool-use, streaming) for exact SDK shapes
- [ ] `tools.ts`: `probe_oauth`, `check_links`, `record_fact` (validate inputs; SSRF guard: https only, block private IPs, timeout 5 s, size cap)
- [ ] `pipeline.ts` stages with typed events; manual agent loop (we need per-event streaming plus capture of `web_fetch_tool_result` text for quote verification); handle `pause_turn`, `tool_use`, refusal, max_tokens
- [ ] `verify.ts`: quote normalization and matching, link liveness, consistency rules, stats
- [ ] `/api/generate` NDJSON stream; `maxDuration = 300`; cache hit returns immediately
- [ ] `/generate` page: stepper + live feed + facts with source chips + elapsed timer; redirect on done; partial-guide fallback
- [ ] Run on 2 apps end to end (one easy, one hard); tune prompt, max_uses, and effort for **quality vs. latency (target under 3 min)**
- **Exit:** a new app typed into the search box produces a saved, shareable guide.

### P4: Library (0:45)
- [ ] `scripts/gen-library.ts` runs the pipeline for the seed list → `data/guides/*.json` (run in background, in parallel with P5)
- [ ] Spot-fix obvious errors, then fix the **prompt** (not just the JSON) when errors repeat
- [ ] Home page: search + grid + filters + tier legend
- **Exit:** 8–10 guides with varied tiers visible on `/`.

### P5: Verification (1:15), proves R14
- [ ] Hands-on attempts (free accounts only, no secrets in screenshots): **GitHub** (create OAuth app), **Slack** (create from the agent's manifest), **Google Cloud** (consent screen; add a restricted Gmail scope; note the warnings, test-user cap, verification prompts), **Notion** (public integration form fields), **Spotify** (dashboard user-limit text)
- [ ] For each: compare with the generated guide → write `data/verification/<slug>.json` (confirmed / corrected / unverifiable)
- [ ] Source spot-check: sample ~15 claims across 5 guides; open each source; record results
- [ ] Note systematic agent errors → prompt or verifier fixes → regenerate the affected guides
- [ ] `/verification` page: summary stats, per-app attempt log, correction table, "what we learned" bullets
- **Exit:** a verification log with real corrections and honest unknowns.

### P6: Deploy and polish (0:45)
- [ ] Deploy to Vercel; set env vars; attach Upstash; check `maxDuration` and test live generation **in production**
- [ ] Guardrails: per-IP rate limit (Upstash ratelimit) and/or `GENERATE_ACCESS_CODE` to protect API spend; input validation; cache identical queries
- [ ] Share polish: OG metadata per guide, copy-link toast, print stylesheet
- [ ] Empty, error, and loading states; mobile check
- **Exit:** public URL works end to end, including a fresh generation.

### P7: README, rehearsal, submit (0:30)
- [ ] README: what it is, live link, setup (`pnpm i`, env, `pnpm dev`, `pnpm gen:library`), architecture diagram, **key decisions** (§12), **evidence model**, **verification summary**, **limitations** (§10), cost per generation, what I'd do next (scale to 100: scheduled refresh, crowd feedback, diffing for doc changes)
- [ ] Rehearse 3 unfamiliar apps live on prod; record timings; fix anything flaky
- [ ] Final credential sweep: `git log -p | grep -iE "sk-ant|secret|token"`; check screenshots
- [ ] Submit the live link + repo link
- **Exit:** submitted.

---

## 8. Prompting rules for the agent (put into `prompts.ts`)
- Prefer **official provider docs**; then official forums and changelogs; then community posts (labeled `community`).
- Every factual claim → `record_fact` with a **verbatim quote** where possible.
- **Separate "documented" from "reported"** timelines. Never invent a number. A range with its basis, or `unknown`.
- Think in **paths**: identify the scope or audience thresholds that change the process.
- Always check: dev-mode limits, review triggers, AI/LLM data-use terms, token lifetimes, Composio status.
- For each step decide the **owner** (agent / you / provider) and generate handoff artifacts where the provider supports manifests, CLIs, or APIs.
- Stop researching when the question bank is answered or the budget is spent. Leave unknowns explicit.

## 9. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Free-tier quota exhausted during the demo | Provider fallback chain, aggressive caching, pre-generated library, run the demo on a fresh daily quota, keep a short screen recording as backup |
| Free models produce weaker research than frontier models | Narrower question bank, deterministic probes + verifier, per-claim evidence grading, hands-on overlays; note it in README limitations |
| Live generation over 300 s or flaky during the demo | Tight max_uses, effort tuning, cache, partial-guide fallback, rehearse; Railway fallback host |
| Hallucinated requirements or timelines | Quote verification, `unknown` allowed, hands-on overlays, consistency rules |
| Structured-output schema too complex or rejected | Keep the schema flat-ish; validate with Zod; one repair retry |
| API spend abuse on the public link | Access code + rate limit + cache |
| Provider console attempts take too long | Timebox 15 min per app; record "couldn't complete because X" (still a finding) |
| Docs gated behind login or JS | Note as unknown; probe what's public |

## 10. Known limitations (README seed)
- Agent researches public docs only. It doesn't log into consoles or submit reviews.
- Timelines for reviews are inherently uncertain; community data is anecdotal.
- Library is a slice (around 10), not 100. The pipeline and script are built to scale.
- Guides go stale; each shows `generatedAt`. A scheduled refresh is future work.

## 11. Cut lines (drop in this order if behind)
1. OG images and print stylesheet
2. LLM critic pass (keep the deterministic verifier)
3. Library filters
4. Library size 10 → 6
5. Path tabs → single default path plus "if you need sensitive scopes…" nuance callouts
**Never cut:** live generation, evidence badges + unknowns, verification log, README, deploy.

## 12. Decision log (append as we go)
| # | Decision | Why |
|---|---|---|
| D1 | Next.js + Vercel single deploy | Fastest path to a shareable link with streaming |
| D2 | ~~Claude Opus 5.5~~ → **free-tier provider chain via Vercel AI SDK (Groq → Mistral → Gemini) + Tavily search + own fetch** (changed 2026-11-11: user has no API key and won't pay) | Zero cost; provider fallback absorbs free-tier 429s; quote verification still works because we capture fetched text ourselves. README tells reviewers they can drop in any key. |
| D3 | Guides are **path-aware** (scope/audience tiers) | Difficulty depends on what you request, not just the provider |
| D4 | **Active effort and waiting time shown separately** | Answers "an hour vs weeks of waiting" from the brief |
| D5 | Evidence graded per claim + deterministic quote check + hands-on overlays | Sound judgment about evidence; regeneration never erases human verification |
| D6 | Composio-managed shortcut shown first | Many developers don't need their own app to start; puts the guide in Composio's flow |
| D7 | Owner chips + handoff kit (manifest/CLI/justifications) | Makes "what the agent does vs. you" concrete |
| D8 | Don't duplicate Composio's composio.dev/auth screenshot walkthroughs; link them for the final wiring step | They cover clicks, not time/review/blockers/evidence. That gap is our wedge |
| D9 | Claims can carry `conflict` + `asOf` | P1 found real conflicts (Spotify client-ID cap; Google reassessment anchor date) and fast-changing facts |
| D10 | Tier rubric 1–4 assigned per path (docs/research-notes.md §5) | Difficulty depends on scopes and audience |
| D12 | **Library guides researched by Claude Code in the dev session** (WebSearch/WebFetch, same schema and evidence rules); the in-app agent (free models) handles **live generation** only | Saves scarce free-tier quota for the live demo; library quality is higher; disclosed in README |
| D13 | **Visual language = Composio's official Brand Hub** → [DESIGN.md](DESIGN.md). DEV dark default, square corners, Geist 400/500 + JetBrains Mono, spot blue #51a2ff for interactive state only; no Composio logo | Reviewers are Composio; official tokens (brand.composio.dev agent.json/llms.txt) beat community DESIGN.md files, which use the retired #0007cd |
| D11 | Guides get a "For AI agents" nuance section | Slack non-Marketplace apps get 1 req/min on conversations.history: "approved" ≠ usable for agents |

## 13. Commands and paths (fill in as created)
- Dev: `pnpm dev` · Library: `pnpm gen:library` · Typecheck: `pnpm tsc --noEmit`
- Env: `.env.local` (never committed); template `.env.example`
- Live URL: _TBD_ · Repo URL: _TBD_

## 14a. The live agent as built (P3)
- **No SDK.** `src/lib/agent/llm.ts` is a small OpenAI-compatible JSON client. Each model is a "lane" with its own token bucket; calls pick the best lane with room, wait when none has, and move lanes on a 429. Lanes come from env keys: Groq (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`), plus Mistral and Gemini if their keys are set. (D2 superseded: the Vercel AI SDK was removed.)
- **Measured Groq free limits (2026-11-11):** 8,000 tokens/minute per model, refilled continuously (~133 tokens/s), 1,000 requests/day per model. Daily token cap is not exposed in headers. A guide uses 22–36k tokens over 10–11 calls.
- **Pipeline** (`src/lib/agent/pipeline.ts`): identify (1 search + 1 call; refuses unmatched queries) → search (6 Tavily queries with page text) → read (3 parallel extraction calls; facts = claim + verbatim quote + source id) → follow up (1 call picks ≤3 gap searches, then more extraction) → write (3 parallel calls: plan, details, materials; they cite fact ids and source ids only, never URLs) → verify (every quote checked against page text; unmatched → status `inferred`, flagged).
- **Deterministic parts:** claims are built from facts in code; evidence grade comes from the source host (provider docs = official; forums, even on the provider's domain, = community); Composio status, callback URL step value and the Composio wiring material are injected in code; tier/wait consistency rules; critical topics with no facts go to `unknowns`.
- **Probes** (`probe.ts`): OIDC/OAuth discovery at common hosts, PKCE, dynamic registration, authorize endpoint with an invalid client. **Safe fetch** (`web.ts`): https only, public IPs only, size and time caps.
- **Run it:** `pnpm gen "<app>" [--save]` (CLI), or the UI at `/generate?q=`. API: `POST /api/generate {query, force}` streams NDJSON `AgentEvent`s. Tavily cost: 7–10 credits per guide.
- **Known weak spots:** path choice varies between runs; steps are mostly owner "you"; 5–25% of quotes fail matching and are flagged.

## 14b. Library and quote check (P4)
- Library guides live in `data/guides/`. Slack, GitHub, Spotify and Outlook are generated by `scripts/build-library.py <scratch dir with probes.json>` (kept for reference; the JSON files are the source of truth). Gmail was hand-written.
- `pnpm verify:quotes` re-fetches every cited source and checks each quote against the page. Result on 2026-11-11: **105 of 105 matched**, saved to `data/verification/quote-check.json` for the verification page.
- Finding from the first run: 10 Gmail quotes failed because Google redirected the fetcher to a machine-translated Arabic page (`?hl=ar`). Fixed by sending `accept-language: en-US`. Worth a line in the verification log and README.
- Not researched (candidates if time allows): Notion (public integration requirements were not on the page read), X/Twitter, Dropbox, Shopify.
- The user asked to stop spending Groq/Tavily quota on test runs; keep it for the deployed demo.

## 14. Implementation notes (for context recovery)
- Schema: `src/lib/schema/guide.ts` (Zod 4). Validate library: `pnpm validate` (schema + claim-id references).
- Library guides: `data/guides/<slug>.json`; hands-on overlays: `data/verification/<slug>.json` (merged in the guide page: confirmed hands_on → status hands_on; corrected → conflict note).
- Loaders: `src/lib/guides.ts` (library → live store fallback); store: `src/lib/store.ts` (Upstash if env set, else `.data/generated/`).
- Guide page: `src/app/guides/[slug]/page.tsx`; components in `src/components/guide/` (claims popovers via ClaimsProvider context, path tabs, checklist, share bar).
- Markdown export: `src/lib/markdown.ts`, served at `/api/guides/[slug]?format=md`.
- UI kit: shadcn "base-nova" = **Base UI** (not Radix): use `render` prop instead of `asChild`. `cn` comes from the `cn` package (published by shadcn).
- **Design audit:** `node scripts/shot.mjs <url> <outPrefix> [w] [h]` screenshots both themes and prints font/radius/overflow violations against DESIGN.md (uses playwright-core + cached headless Chromium). Run it on every new page.
- **Hierarchy rules (DESIGN.md §8a):** answer first, rows collapsed by default, one evidence marker per sentence, explanations in `Tip`/`Hint` (src/components/tip.tsx), no intro paragraphs. The user asked for this twice; apply it to every new page.
- **Copy register (DESIGN.md §8b):** professional, neutral, noun labels. The agent's synthesis prompt in P3 must require this for generated guide text.
- **Layout:** pages use the full 1240px container with two-column bands; do not fall back to a narrow single column.
- Styling building blocks: `label-mono` / `meta-mono` / `shadow-elevated` utilities (globals.css), `Chip` (src/components/chip.tsx), tones in `src/lib/ui-meta.ts`, theme via next-themes (default dark) in `src/components/theme.tsx`. New pages (/, /generate, /verification, /about) must use these.
- Screenshots (raw): headless Chrome at `~/Library/Caches/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-mac-arm64/chrome-headless-shell --headless --screenshot=… --window-size=W,H URL`.
- Library guide writing recipe (D12): fetch official pages with WebFetch asking for VERBATIM quotes; every claim gets status + quote + source; probe discovery/authorize endpoints with curl; record conflicts and stale sources (e.g. Nylas 2019 cost figure vs CASA 2024 pricing).
