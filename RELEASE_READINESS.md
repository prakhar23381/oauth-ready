# Release readiness: OAuth Ready

- **Audit date:** 2026-11-18
- **Branch:** `release-readiness/2026-11-18`
- **Audited commit:** `b232663` (main)
- **Target:** Vercel serverless (Node), public demo, no PII or payments. It holds three API credentials (Groq, Tavily, Vercel Blob).
- **Constraints, agreed before starting:**
  - Mocks only: no real Groq or Tavily calls.
  - Strictly local: production was not contacted.
  - Tool installs allowed: dev dependencies on this branch, scanners outside the repo.

## 0. Status after fixes (branch `fix/release-readiness-2026-11-18`, commit `ab5fb43`)

**Verdict after fixes: GO-WITH-CONDITIONS.** All 22 findings are fixed, except F20, which was a measurement artefact and needed no code change. The only remaining conditions are checks that can only be done on Vercel.

**Checks on the final build:**
- **Tests:** 89 pass (79 from the audit plus 10 regression tests), stable over repeated and shuffled runs.
- **Type check and lint:** `tsc --noEmit` and `eslint --max-warnings=0` are clean.
- **Production dependency audit:** `pnpm audit --prod` reports no known vulnerabilities (was 5 high and 3 moderate).
- **axe:** 0 violations on 6 pages in both themes (was 99).
- **Lighthouse:** accessibility 100. Performance 95 on home and 94 on a guide page, over 3 runs each.

Each original reproduction was re-run against a fresh clone of the branch, set up exactly as the README says, built, and served with `next start`.

| ID | Fix | Re-run evidence |
|---|---|---|
| F1 | Strict integer parsing (`envInt`); `.env.example` lines commented out | README flow returns "no model API key" instead of "Limit reached: 0" |
| F2 | Body validated with Zod | `null`, `42`, `["a"]` and `{"$ne":""}` all return 400 |
| F3, F14 | Two-layer limiter: per-instance memory, then Redis or Blob. Refused requests never count toward the daily budget, and store errors fall back to the memory layer (logged). | Store tests pass |
| F4 | Blob counter per day, updated with compare-and-swap (`ifMatch` ETag, retried on conflict) | Two module instances sharing a fake store with ETag semantics: exactly 6 of 12 concurrent requests allowed, stable over 5 runs. Planting a bug that removes `ifMatch` fails the test. |
| F5 | Hashed slug for names without Latin letters | `微信` and `카카오` get different slugs |
| F6 | `PublicError` for user-facing messages; everything else is generic, with a reference ID that appears in the logs | API test passes |
| F7, F8 | Quote-aware tag stripping; long lines split at sentence ends | Web tests pass |
| F9 | Slug allow-list in loaders and the store | Traversal URLs return 404 |
| F10 | A stream that ends without `done` or `error` becomes an error; unreadable lines get a plain message | All four failure modes show "Research stopped" with "Try again" |
| F11 | On Vercel, the per-IP key comes from `x-real-ip` / `x-vercel-forwarded-for` (set by the platform) | Unit tests. **Header behaviour on Vercel not yet observed.** |
| F12 | JSON content type required (415); cross-origin `Origin` or `Sec-Fetch-Site` rejected (403) | Evil-origin requests get 415 or 403; same-origin browser flow returns 200 |
| F13 | The SSRF check moved into the socket's DNS lookup (undici `Agent` passed to `fetch`), so the address that is checked is the address that is connected to | A local server that `fetch` reaches without the agent is blocked with it. Public pages still load (example.com, Google docs). |
| F15 | Live research refused on Vercel without a durable store; error logged at startup | Store test passes |
| F16 | JSON log lines per run, refusal and store error; README lists them | Seen in server output |
| F17 | Semantic and text tokens adjusted in lightness only, documented in DESIGN.md §8c | axe colour-contrast: 85 violations down to 0 |
| F18, F19 | No interactive controls inside `<summary>` or buttons; labelled table header | axe: 0 violations |
| F20 | No code change. Re-measured over 3 runs: home TBT 20–30ms, performance 95. The original 1,210ms was a single run against a freshly started server. | Lighthouse |
| F21 | `/api/health` (configuration as booleans, no external calls), CI workflow (typecheck, lint, validate, test, prod audit, build), operations section in the README | `/api/health` returns 200 `degraded` with no keys |
| F22 | Removed 9 unused UI files and 3 unused dependencies; `shadcn` moved to dev; `postcss` and nested `zod` overridden to patched versions | Production audit clean; build passes |

**Verified on a Vercel preview** (2026-11-19).
- **Setup:** branch `fix/release-readiness-2026-11-18`, deployed with the CLI. The Groq and Tavily keys are added as Preview variables scoped to this branch only; Blob is shared with production.
- **Infrastructure:** Vercel runs **Node v26.13.1**. Development and CI use Node 22.
- **Deployment protection:** previews are behind Vercel login (plain requests get a 302). The checks below went through `vercel curl`.

| Check | Result |
|---|---|
| Pages and API smoke test | All 12 routes return the expected code (`/guides/nope` 404) |
| `/api/health` | `ok`: live research available, store `blob`, durable |
| F2, F9 | `null` body 400, numeric query 400, traversal 404 |
| F12 with real Vercel headers | `text/plain` 415, evil `Origin` 403, `Sec-Fetch-Site: cross-site` 403. Same-origin request (`Origin` = preview URL) 200. Rejections logged as `generate.rejected`. |
| F11 | Spoofed `X-Forwarded-For` values never reached the app: the hashed diagnostics show `x-real-ip`, `x-vercel-forwarded-for` and `x-forwarded-for` all equal to the real client address, so Vercel overwrites the header. The rate-limit key uses the real address. |
| F4 on the real Blob store | The counter `limits/<day>.json` is created and updated with compare-and-swap (9 runs counted, no `limiter.store_error`). The 7th request this hour was refused with "Limit reached: 6 live research runs per hour". |
| Full live run (Dropbox) | 65s, 33 facts, 32 quotes matched, guide saved to Blob, `/guides/dropbox` 200 |
| **F23 (new, found here, fixed)** | The endpoint probe reported "no discovery document" for Dropbox, which has one. A diagnostic preview showed `fetch failed: invalid onError method` (`UND_ERR_INVALID_ARG`): Node 26's built-in `fetch` rejects an undici 6 `Agent`. Locally, Node 22 bundles undici 6, so every local test passed. **Fix:** `safeFetch` uses undici's own `fetch` with its `Agent`. Re-checked on Vercel: `safeFetch` 200, metadata IP blocked, Dropbox probes find the discovery document and authorize endpoint. Regression test added. |
| `.env.local` upload check | A probe deploy with a dummy `.env.local` (`TAVILY_API_KEY=dummy`) reported `searchKey: false`. The CLI does not upload git-ignored env files, so past production deploys never shipped the local keys file. |

**Findings from the preview:**
- **F23 (fixed):** see the table above. More generally, dev and CI run Node 22 while Vercel runs Node 26. Pinning one version (`engines` in `package.json`, and the CI `node-version`) would keep runtime bugs reproducible locally.
- **F24 (process):** the project is connected to GitHub. Every push to a branch deploys a preview, and **every push to `main` deploys production automatically**; production currently runs `main` at `b232663`, auto-deployed on 17 November. Merging this branch therefore ships to production immediately, so the merge itself is the release step.
- **F25 (data):** previews share production's Blob store. Guides generated on a preview (Dropbox) appear on production's "Recently researched", and preview test runs count toward production's daily limit (11 of 40 used on 2026-11-18 UTC).

**Still to do before the release is fully verified:**
1. A live research run on the *final* preview build, to see the probe fix inside the app and not just the diagnostic route. My IP used its 6 runs this hour; the window resets at 22:00 UTC.
2. Rollback rehearsal. `vercel rollback` only acts on production, so it can't be rehearsed on a preview. Proposed: after the merge auto-deploys, run `vercel rollback` to the current production deployment (`dpl_7Mx7tPbnd6jt11AtivisSWjJRpde`), check it, then promote the new one again.

Not covered by any fix: live model output variance, and the free-tier quota itself.

---

## 1. Verdict before fixes: NO-GO, by the stated blocker rules

1. The new test suite has **13 non-flaky failing tests**. Each one documents a real source bug, and the blocker rule "failing tests" applies.
2. No dependency issue is exploitable, no secrets were found, and the build is clean. The failures are logic, input-validation and abuse-resistance bugs.
3. **Six fixes, about half a day of work, would turn this into GO-WITH-CONDITIONS:** F1, F2, F9, F10, F12, F14. The remaining conditions would be F15/F16 and an untested rollback.

The currently deployed site works for its main journeys. The verdict reflects what can be abused or can fail without anyone noticing, not what is broken today for an ordinary visitor.

## 2. Summary

| Phase | Status | Key evidence |
|---|---|---|
| 0 Discovery | PASS | Next.js 15 / React 19 / TypeScript strict, pnpm with a lockfile. No tests, CI, Dockerfile or IaC existed. |
| 1 Clean-room build | PASS, with 1 High finding | Fresh clone, `pnpm install --frozen-lockfile` (empty store, 17.5s), `pnpm build` exit 0, no warnings. Lockfile consistent (offline frozen reinstall OK). **Following the README exactly disables live research (F1).** |
| 2 Static analysis | PASS | `tsc --noEmit` exit 0 (also with noUnused*/noImplicitReturns), `eslint --max-warnings=0` exit 0, madge reports no cycles, no TODO/FIXME. knip shows unused dependencies and files (F22). |
| 3 Automated tests | FAIL (bugs found) | 79 tests added: 66 pass, 13 fail, all source bugs. Identical across 3 runs and 2 shuffled seeds, so 0 flaky. Coverage of `src/lib`: 84.2% lines, 70.0% branches (Vitest 5 / v8). Manual mutation check: 3 planted bugs, 3 caught after one test was added. |
| 4 Behavioural | FAIL | `next start` smoke test of 15 routes all OK. API fuzz shows 500s (F2) and path traversal (F9). The UI hangs on a truncated stream (F10). The per-IP limit can be bypassed with headers locally (F11). |
| 5 Security | FAIL (no blocker) | `pnpm audit --prod`: 5 high and 3 moderate advisories, **none reachable at runtime**. gitleaks: 26 commits, 0 leaks. Tree and client bundle: 0 real secrets. Semgrep (260 rules): 0 findings. XSS attempts blocked by React. **Cross-site quota drain (F12).** |
| 6 Data & migrations | N/A, mostly | No database. Guides stored by pipeline 0.2 still parse under the current schema. |
| 7 Config | FAIL | Missing keys degrade cleanly. **The limiter fails open (F14)**, storage on Vercel silently becomes ephemeral (F15), and empty or non-numeric limit variables misparse (F1). |
| 8 Resilience | PARTIAL | Search 503, model 500 and 429, and a store write failure all produce clear errors with bounded retries. A stream ending without a result hangs the UI (F10). Upstream error text reaches users (F6). |
| 9 Performance | PASS for a demo | Local single process: JSON API 620 req/s (p99 55ms). Guide page 46 req/s (p50 374ms) at 20 connections, saturating near 57 req/s; errors and timeouts at 300 connections. Lighthouse home: performance 65 (TBT 1.2s). Gmail guide: 94. |
| 10 Deployment mechanics | PARTIAL | The production artifact runs locally. No health endpoint, no CI. Rollback rehearsal SKIPPED (strictly local). |
| 11 Observability | FAIL | No server-side logging anywhere in `src` (F16), no metrics or alerts, no runbook section. |
| 12 Frontend | PARTIAL | axe: colour contrast (serious, mostly light theme), nested interactive controls (serious), one empty table header. Lighthouse accessibility 96/97, no console errors, no horizontal overflow (earlier audit script). |

## 3. Findings

Each one comes with a reproduction and evidence. Test names refer to `tests/*.test.ts` on this branch.

### High

**F1. Following the README disables live research.**
- **What happens:** `.env.example` ships `GENERATE_LIMIT_PER_IP=` and `GENERATE_LIMIT_PER_DAY=` with empty values. `src/lib/store.ts:90` computes `Number(process.env.X ?? 6)`, and `??` does not catch `""`. `Number("")` is 0, so every run is refused. A non-numeric value gives `NaN`, and `n > NaN` is always false, which silently removes the limit.
- **Reproduce:** fresh clone, `pnpm install`, `cp .env.example .env.local`, `pnpm dev`, then `curl -X POST localhost:3000/api/generate -d '{"query":"Strava"}'`.
- **Evidence:** the response is `{"type":"error","message":"Limit reached: 0 live research runs per hour. ..."}`. Failing test: store, "falls back to the default when the variable is set but empty".
- **Production impact:** none, because those variables are unset there.
- **Fix:** parse with a helper that treats empty, non-numeric and negative values as the default, or comment the lines out in `.env.example`.

### Medium

**F2. `POST /api/generate` returns 500 on a non-string query or a JSON `null` body.**
- **Where:** `src/app/api/generate/route.ts:12-13` calls `.trim()` on an unvalidated value.
- **Reproduce:** `curl -X POST localhost:3200/api/generate -H 'content-type: application/json' -d '{"query":42}'` returns 500. A body of `null` or `{"query":["a"]}` also returns 500.
- **Evidence:** the server logs `TypeError: (t.query ?? "").trim is not a function` and `Cannot read properties of null (reading 'query')`. Four failing tests in api.
- **Fix:** validate the body with Zod and return 400.

**F9. Path traversal in the guide loader.**
- **Where:** `src/lib/guides.ts:31` builds `path.join(DATA_DIR, "guides", `${slug}.json`)` from the URL. The same pattern exists in `store.ts` (file path and Blob pathname).
- **Reproduce:** `curl localhost:3200/api/guides/..%2Fguides%2Fgmail` and `..%2F..%2Fdata%2Fguides%2Fslack` both return 200.
- **Impact:** only files that parse as a guide can be read, so impact today is low. But the only defence is a schema check that was never meant to be a security control.
- **Fix:** accept only slugs matching `^[a-z0-9-]{1,64}$` at the route boundary.

**F10. The research page hangs forever if the stream ends without a final event.** This is what a Vercel `maxDuration` (300s) kill looks like.
- **Where:** `src/components/generate-console.tsx:94-95`. The reader loop exits with no "ended without a result" branch.
- **Reproduce:** Playwright route mock that sends `stage` and `search` events, then closes the stream.
- **Evidence:** after 4 seconds the heading still says "Researching Acme", the spinner is shown, and there's no "Try again". By contrast, HTTP 500, error events and malformed lines are handled. The malformed case shows the raw parser message.
- **Fix:** treat end-of-stream without `done` or `error` as an error, and add a client-side watchdog.

**F12. Cross-site requests can start research runs, draining quota or denying live research.**
- **Reproduce:** `curl -X POST localhost:3200/api/generate -H 'origin: https://evil.example' -H 'content-type: text/plain;charset=UTF-8' -d '{"query":"Strava"}'` returns 200 and enters the research path. `text/plain` is a CORS "simple request", so browsers send it without a preflight.
- **Impact:** any website can make each of its visitors trigger a run. Each visitor has a different IP, so the per-IP limit doesn't apply, and the 40-per-day cap can be exhausted for everyone.
- **Fix:** require `content-type: application/json`, which forces a preflight that fails cross-origin, and/or reject requests whose `Origin` or `Sec-Fetch-Site` is cross-site.

**F14. The rate limiter fails open when the store errors.**
- **Where:** `src/lib/store.ts:133`, `catch { /* allow */ }`.
- **Evidence:** failing store test "Blob: a store outage does not silently remove the rate limit": 20 of 20 checks allowed while Blob throws.
- **Impact:** an expired or revoked `BLOB_READ_WRITE_TOKEN` removes all spending limits, while every generated guide also fails to save.
- **Fix:** fail closed for research runs, or fall back to the in-memory limiter, and log it (see F16).

**F3. With Redis, one client can exhaust the global daily budget.**
- **Where:** `src/lib/store.ts:117` increments the daily counter before checking the per-IP result.
- **Evidence:** failing store test. After 60 refused requests from one IP, a new IP is refused with "daily limit reached".
- **Status:** dormant. Production uses Blob, but this becomes live the moment Upstash is configured, which the README recommends.
- **Fix:** check the per-IP limit first, and only increment the daily counter for allowed runs.

**F4. With Blob, the per-IP limit is not enforced under concurrency.**
- **Where:** `src/lib/store.ts:125` lists existing runs, then writes a new marker. That's check-then-write, so concurrent requests race.
- **Evidence:** failing store test. 12 of 12 concurrent requests were allowed against a limit of 6.
- **Also:** every request, even a refused one, costs two Blob list operations against the plan's operation quota.
- **Fix:** use Redis `INCR`, or accept and document the bound.

**F15. On Vercel without Redis or Blob, guides silently go to ephemeral storage.**
- **Where:** `src/lib/store.ts:23-24`.
- **Evidence:** failing store test. With `VERCEL=1` and no store configured, `storeBackend === "file"` in `os.tmpdir()`.
- **Impact:** share links break on the next cold start, and nothing warns about it.
- **Fix:** refuse to run research on Vercel without a durable store, or at least log loudly at startup.

**F16. There is no server-side logging.**
- **Evidence:** `grep -rn "console\.(error|warn|log)" src` finds nothing. Failed runs, limiter refusals and store errors are streamed only to the browser.
- **Fix:** add structured `console.error` or `console.info` calls with a run ID at each catch and at the end of each run.

**F17. Colour contrast (accessibility, serious).**
- **Evidence:** axe flags 85 elements across 7 page and theme combinations, almost all in the light theme:
  - the 45%-alpha "subtle" text at 3.03:1 (49 nodes)
  - the warning amber at 2.87–3.1:1
  - the success green at 4.11–4.44:1
  - the destructive red at 4.43–4.46:1, in both themes
- **Where:** `src/app/globals.css:75` (`--subtle-foreground`) and the semantic tokens.
- **Fix:** darken these tokens in light mode, and raise the subtle alpha to 0.6.

**F18. Nested interactive controls (accessibility, serious).**
- **Evidence:** axe flags 12 elements on 4 pages: info-tip buttons sit inside `<summary>` row headers on the guide and verification pages.
- **Fix:** move the tip out of the summary, or make the row a plain button.

### Low

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| F5 | Non-Latin app names all get slug `app` and overwrite each other's stored guide | `slugify("微信") === slugify("카카오") === "app"` (`pipeline.ts:14`), failing schema test | Transliterate, or fall back to a hash of the name |
| F6 | Raw upstream error text is shown to users | `llm.ts` includes 200 characters of provider error bodies; the route streams `e.message` verbatim; failing api test | Map to generic messages and log the details server-side |
| F7 | `htmlToText` leaks attribute text when an attribute contains `>` | `<a title="a>b">link</a>` gives `b" href="/x">link` (`web.ts:80`), failing web test | Use an HTML tokenizer |
| F8 | `excerpt()` drops everything after the first 1,100 characters of a long single-line paragraph | A fact at character ~4,800 is never offered to the model (`web.ts:113,117`), failing web test | Split long lines into sentence windows |
| F11 | The per-IP limit is keyed on a client-supplied `X-Forwarded-For` | Locally, 8 different header values give 8 of 8 allowed. Vercel documents that it overwrites this header, but that is **not verified** | Use the platform IP (`@vercel/functions` `ipAddress`) |
| F13 | The SSRF guard is check-then-fetch, so DNS rebinding can bypass it | `web.ts:31` resolves the host, then `web.ts:48` resolves it again. Not demonstrated, since that needs a controllable DNS server. | Validate inside the socket lookup, or pin the connection to the resolved IP |
| F19 | Empty table header | axe `empty-table-header`, verification page, live-runs table | Add a visually hidden label |
| F20 | Home page blocks the main thread under throttling | Lighthouse home: TBT 1,210ms, performance 65 (single run) | Profile hydration and defer theme and search JS |
| F21 | No health endpoint, CI, or deploy/rollback runbook | Repo inspection | Add `/api/health`, a CI workflow (typecheck, lint, test, build) and a README section |
| F22 | Dependency hygiene | `shadcn` (a CLI) is a runtime dependency and pulls in 2 of the 5 high advisories, unreachable. Unused: `@upstash/ratelimit`, `sonner`, 9 unused UI files. | Move `shadcn` to dev or remove it, and prune the rest |

Informational, not findings:
- Concurrent requests for the same new app both run full research; there's no in-flight de-duplication.
- A run refused for missing keys still counts toward the limit.
- A client disconnect does not cancel the server-side run.
- Dates are UTC.
- In development, React StrictMode can start two server runs per visit.
- The LGPL `sharp-libvips` is dynamically linked.
- `.next/` holds per-build Next.js keys. It is git-ignored and never deployed.

## 4. Tests, coverage and untested areas

- **New tests:** 79 in `tests/` (api, llm, pipeline, schema, store, web). External services are mocked; property tests use fast-check. **0 flaky** across 3 repeat runs and shuffled seeds 4242 and 99.
- **Coverage of `src/lib`:** 84.2% lines, 70.0% branches, 77.2% functions.
- **Lowest coverage:**
  - `agent/probe.ts` at 1.9%: network-only, mocked out.
  - `store.ts`: the Redis and Blob read paths.
  - `guides.ts`: overlays.
- **Not unit-tested at all:** route handlers' streaming under real timeouts, React components (exercised only by Playwright scripts), and `scripts/`.
- **Mutation check:** a planted "quote threshold 0.85 to 0.1" bug initially survived, which exposed a missing half-invented-quote test. That test is now added and catches it.

## 5. Skipped, and the risk that remains

| Skipped | Why | Residual risk |
|---|---|---|
| Real Groq and Tavily end-to-end | Constraint: mocks only | Live model behaviour, such as schema drift and variance, isn't covered here. Earlier production runs (32–83s) are the only evidence. |
| Any request to production, and the rollback rehearsal | Constraint: strictly local | Vercel-specific behaviour is unverified: the `X-Forwarded-For` overwrite (F11), cold start, the 300s kill (F10), and instant rollback. |
| osv-scanner | brew install failed ("Command Line Tools are too outdated") | Advisories are covered only by `pnpm audit` (GitHub advisory DB). |
| Full Stryker mutation testing | Time; a manual 3-mutant check was done instead | Test strength is only partly measured. |
| Soak test, slow-network UI beyond first paint | Time | Memory stays around 665MB after load and isn't released (not proven a leak). |
| Formal SBOM | pnpm 10.8 has no `sbom` command | A licence inventory exists; no CycloneDX file. |
| Contract diff | No previous API schema | n/a |
| Cross-browser | Chromium only | Firefox and Safari rendering unverified. |

## 6. Pre-deploy checklist and rollback plan

Before the next production deploy:
- [ ] Fix F2 (validate the body) and F9 (allow-list slugs).
- [ ] Fix F12 (require JSON and check the origin) and F14 (fail closed).
- [ ] Fix F10 (end-of-stream handling).
- [ ] Fix F1 (`.env.example` and parsing).
- [ ] Add logging (F16) and confirm it appears in Vercel logs.
- [ ] Confirm `BLOB_READ_WRITE_TOKEN` is set for production (F15).
- [ ] Run `pnpm exec tsc --noEmit && pnpm exec eslint . && pnpm exec vitest run && pnpm build`. All 79 tests should pass once the fixes land.
- [ ] Deploy to a **preview** first, then smoke-test `/`, one guide, `/verification`, one cached generate, and one invalid generate.

Rollback (untested in this audit):
1. Run `vercel rollback` or use "Instant Rollback" in the dashboard to return to the previous production deployment.
2. Stored guides are plain JSON in Blob, and the schema has stayed backward compatible so far, so no data migration is needed.
3. Re-run the smoke checks.
4. Rehearse this once on a preview before relying on it.

## 7. What this audit could not prove

- Behaviour on Vercel itself: header handling, timeouts, cold starts, Blob latency and rollback.
- Exploitability of F13 (DNS rebinding) and F11 (header spoofing) in production.
- That the free models produce schema-valid, consistent output; tests mock them.
- Performance under real traffic. Load tests ran against one local process, not serverless scaling.
- Accessibility beyond automated axe and Lighthouse checks: no screen-reader or keyboard walkthrough was done.

## Evidence and commands

- **Tests:** `pnpm test` (runs `vitest run`); coverage with `pnpm exec vitest run --coverage --coverage.reportOnFailure`.
- **Fuzzing, load and accessibility:** run against `next start` on port 3200 from a clean clone with empty keys and `GENERATE_LIMIT_PER_IP=6`.
- **Scanners:**
  - `pnpm audit --prod --json`
  - `gitleaks git . --redact`
  - `gitleaks dir . --redact`
  - `semgrep scan --metrics=off --config p/typescript --config p/nextjs --config p/react --config p/secrets --config p/owasp-top-ten src scripts`
- **Lighthouse:** `pnpm dlx lighthouse@12 <url>`, run with Brave as `CHROME_PATH`.
- **Source changes:** none. The audit branch adds only `tests/`, `vitest.config.ts`, dev dependencies (`vitest`, `@vitest/coverage-v8`, `fast-check`, `axe-core`), the `test` script and this report.
