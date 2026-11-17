# OAuth Ready

**Live:** https://oauth-ready-lake.vercel.app

OAuth Ready tells a developer how long and how hard it is to get a provider's OAuth app approved so their users can connect. Each guide is evidence-graded and shareable. A research agent writes one live for any app you enter.

- **Library:** five reviewed guides chosen to cover every difficulty tier: GitHub, Outlook, Gmail, Slack, Spotify.
- **Live research:** enter any app name or website on the home page. The agent researches it in about 30–90 seconds and saves a guide with a share link.
- **[Verification log](https://oauth-ready-lake.vercel.app/verification):** what was checked, what was corrected and what remains unverified.

## The problem, and the scope I chose

A provider OAuth app (client ID and secret) identifies the developer's product to Google, Slack and so on. Its review status limits every end user who connects through it. Composio lets developers start on a managed app for 126 toolkits. Production usually needs the developer's own app for branding, quota and scopes, and 275 toolkits always need one.

Researching this showed three things that shaped the product:

1. **There are two clocks.** A first test connection takes minutes. Approval for real users can take months. Docs blur the two, so every guide shows active effort and provider review time separately.
2. **Difficulty depends on the path, not the provider.** Gmail is self-serve for internal tools, up to 10 days of review for send-only scopes, and weeks plus a paid security assessment (CASA) for reading mail. So a guide is a set of paths, each with its own tier and timeline.
3. **What blocks an AI agent is often not the review.** Slack apps outside its Marketplace can call `conversations.history` once a minute. Google test-mode refresh tokens expire after 7 days. Strava bans AI use of its data. Every guide has a section for these.

**In scope:** OAuth 2.0 providers, time and effort to production, requirements, blockers, what an agent can prepare, and how to wire the result into Composio.
**Out of scope:** signing in to provider consoles, submitting reviews, and non-OAuth auth (the agent notices it and writes an API-key guide instead).

## Key decisions

| Decision | Why |
|---|---|
| **Every claim carries an evidence grade** (hands-on, official doc, live probe, community report, inferred, unknown) with its quote and source | Developers can tell documented facts from forum anecdotes. Conflicting sources are shown, not resolved silently. |
| **Quotes are checked in code, not by the model.** Each extracted quote is matched against the text of the page it came from. Unmatched quotes are marked unverified. | Free-tier models paraphrase and occasionally invent. The check makes this visible. |
| **The writing step can cite only fact and source IDs.** URLs, the Composio callback and Composio wiring are added in code. | The model cannot invent links. |
| **The Composio shortcut comes first.** Each guide says whether a Composio-managed app exists and when your own app is needed. | Many developers don't need their own app yet. Composio already has click-by-click setup walkthroughs, so the guides link to those and cover what they don't: time, review, risk and evidence. |
| **Steps are tagged by owner:** the agent can prepare it, you must do it, or you are waiting on the provider. The agent drafts manifests, CLI commands, form values and review justifications. | This answers "what can an agent do for me". |
| **Free-tier models only** (Groq `gpt-oss-120b`, `gpt-oss-20b`, `qwen3.8-27b`) with Tavily search. A small client spreads calls across models by token budget and waits briefly on rate limits. | No paid API key. Mistral or Gemini keys are used automatically if set. |
| **Library guides were researched in the development session** with the same schema and evidence rules. Live generation runs on the deployed app. | Higher-quality library guides, and the free quota is saved for live use. |
| **Design follows Composio's [Brand Hub](https://brand.composio.dev)** ([DESIGN.md](DESIGN.md)). Answer first, details on demand. | It uses Composio's published design tokens. It is not a Composio product. |

## How the agent works

`src/lib/agent/pipeline.ts`, about 10–13 model calls and 25–40k tokens per guide:

1. **Identify:** confirms the query is a real product and plans six searches. Nonsense queries are refused.
2. **Search:** runs the searches and keeps official documentation and developer reports. A provider's own forum counts as community evidence.
3. **Read:** extracts facts in parallel. Each fact has a verbatim quote and a source.
4. **Follow up:** finds gaps and runs up to three more searches.
5. **Write:** produces the plan, supporting sections and drafts in parallel, from the facts only.
6. **Verify:** checks every quote against its page. Critical topics with no evidence are listed as unknown.

Alongside, it probes the provider's OAuth endpoints without credentials: discovery documents, PKCE support, dynamic client registration, and whether the authorize endpoint responds. Progress streams to the page as NDJSON.

## What was verified

- **Library quotes:** `pnpm verify:quotes` re-fetches every cited page and checks every quote. Result: 105 of 105 matched. The first run failed 10 because Google served our fetcher a machine-translated page. The fetcher now requests English.
- **Corrections:** six are recorded on the verification page, for example a widely cited $15k–$75k Google assessment cost that predates CASA, and agent bugs found in testing.
- **Live runs:** Strava, Pipedrive, OpenWeatherMap, Calendly and Webflow, at 32–83 seconds each with 67–89% of quotes matched. Unmatched quotes are flagged in the guide.
- **Hands-on attempts in provider consoles:** not done yet. The overlay format and page support them (`data/verification/<slug>.json`).

## Limitations

- **Live guides are written by free models and not reviewed by a person.** Paths, time estimates and step owners vary between runs.
- **Effort estimates are judgement.** Providers publish review times, not developer effort. Every estimate shows its basis.
- **Each guide is dated, and none refresh automatically.** Provider policies change often: Spotify changed its rules twice in 2026.
- **The endpoint probe only checks standard discovery locations.** It misses providers that publish elsewhere, such as GitHub.
- **Live research is limited** to 6 runs per visitor per hour and 40 per day, to stay within free quotas.
- **Five library guides, not 100.** The schema, pipeline and quote check are built to scale. A scheduled refresh and a review queue for live guides would come next.

## Run it locally

Requirements: Node 22 and pnpm. Free keys from [Groq](https://console.groq.com/keys) and [Tavily](https://app.tavily.com), no card needed.

```bash
pnpm install
cp .env.example .env.local     # add GROQ_API_KEY and TAVILY_API_KEY
pnpm dev                       # http://localhost:3000
```

| Command | What it does |
|---|---|
| `pnpm gen "<app>" [--save]` | Runs the research agent in the terminal |
| `pnpm validate` | Checks library guides against the schema and claim references |
| `pnpm verify:quotes` | Re-fetches sources and checks every library quote |
| `node scripts/shot.mjs <url> <out>` | Screenshots a page in both themes and audits fonts and layout against DESIGN.md |

Generated guides are stored in `.data/` locally. On Vercel they go to a private Blob store (`BLOB_READ_WRITE_TOKEN`), or to Upstash Redis if configured. No credentials are committed.

## Layout

```
src/lib/agent/        research agent: pipeline, prompts, model client, web tools, probes
src/lib/schema/       guide schema (Zod), shared by the agent, the library and the UI
src/app/              pages: home, /generate, /guides/[slug], /verification, /about; API routes
data/guides/          library guides
data/verification/    quote check results, findings, hands-on overlays
docs/research-notes.md  initial research
PLAN.md               build plan and decision log
```
