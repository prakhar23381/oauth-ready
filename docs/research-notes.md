# P1 Research Notes (2026-11-11)

These feed the README ("what we learned") and the agent's prompts. Each line names its source and how strong the evidence is.

## 1. Composio's model: OAuth app vs. auth config vs. connected account

- **Auth config**: "Auth configs control how users authenticate with a toolkit." It uses either Composio's managed OAuth app or your own client ID and secret. [docs: custom-auth-configs]
- **Connected account** = one end user's authorized connection under an auth config.
- **Callback URL for your own OAuth app**: `https://backend.composio.dev/api/v3/toolkits/auth/callback`. It "must exactly match `oauth_redirect_uri` in your Composio auth config". Some toolkit defaults still use the older v1 URL, which still works. [docs.composio.dev/docs/custom-auth-configs, legacy-marked page]
- **Switching to your own app**: create an auth config with your credentials in the dashboard, then pass its ID in the session's `authConfigs`, keyed by toolkit. "Creating the auth config isn't enough on its own." Toolkits you leave out keep using managed auth. [docs: custom-app-vs-managed-app]
- **When managed is enough**: use it while building and iterating. It's fine in production too, "if their consent branding, scopes, and shared provider quotas fit your product."
- **When you need your own app**: [same page]
  - your name on the consent screen
  - scopes beyond Composio's defaults
  - quota, since "Managed apps share quota across all Composio users"
  - faster polling triggers ("Managed auth enforces a 2-minute minimum polling interval")
  - self-hosted or regional instances
  - enterprise branding requirements
- **Ownership vs. custody**: your own app "changes app ownership, branding, scopes, and provider quota, not token custody."
- **White-labeling the Connect Link page** (logo and title) is possible *without* your own OAuth app, but the provider's consent screen still shows Composio. [docs: white-labeling]
- **Directory**: 126 toolkits have managed OAuth and 275 need your own app. You can check programmatically through `composio_managed_auth_schemes`. [docs.composio.dev/toolkits/managed-auth]

## 2. What already exists, and the gap

- Composio has **86 "How to connect X to Composio" guides** at composio.dev/auth.
- The Google guide, for example, is a screenshot walkthrough: GCP project → consent screen → client → Composio auth config.
- It has **no review timelines, no CASA, no sensitive/restricted scope tiers, no testing-mode caps or token expiry, no effort estimates, no blockers, and no cited sources or dates.** Its only hint: "Depending on your configuration, you may need to submit the app for Google verification."
- **Our wedge:** answer *"how long and how hard until real users can connect, and what's in the way?"* Link to Composio's walkthrough for the final Composio wiring step instead of duplicating it.

## 3. Calibration facts for hard cases (they show why paths and evidence grading matter)

### Google: restricted scopes (Gmail)
- **[official]** Restricted-scope verification "can potentially take several weeks" because it includes an independent security assessment (CASA, via the App Defense Alliance).
- **[official]** Reassessment is required at least every 12 months.
- **[conflict]** Two Google pages give different start dates for that 12-month window: the LOA approval date vs. the prior LOV effective date.
- **[community/vendor]** "4–8 weeks minimum".
- **[community/vendor]** Sensitive-scope review is cited as "3–5 business days" by one vendor and "10 business days" by another (conflicting).
- **[community]** Forum threads report getting stuck waiting on Trust & Safety email (2026).
- Sources:
  - developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
  - support.google.com/cloud/answer/13463816
  - nylas.com/blog/google-oauth-app-verification
  - discuss.google.dev threads

### Spotify: gated
- **[official]** The February 2026 dev-mode changes:
  - cap is **5 authorized users** per Client ID
  - the app owner needs **Spotify Premium**
  - one Client ID per developer
  - Dates: new apps on 2026-02-11, existing apps migrated on 2026-03-09.
- **[community]** Extended quota requires a registered business, ~250k MAU, a launched service, and core markets.
- **[conflict]** A third-party guide says the client-ID cap was raised to 25 on 2026-07-23. Unverified.
- Sources:
  - developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security
  - developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide

### Slack: a nuance specific to agents
- **[official]** For commercially distributed apps **not approved for the Slack Marketplace**, `conversations.history` and `conversations.replies` drop from Tier 3 to **Tier 1: 1 request/min, 15 messages per request**.
  - New apps and installs were affected immediately from 2025-05-29.
  - Existing installs were affected from 2026-03-03.
- **[official]** Marketplace apps and internal customer-built apps are exempt.
- This matters a lot for AI agents that read channel history: **Marketplace review becomes part of reaching production.**
- Sources:
  - docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps
  - api.slack.com/changelog/2025-05-terms-rate-limit-update-and-faq

## 4. Implications for the product (and decisions)

1. **Difficulty depends on the path.** Google with basic scopes ≠ Google with Gmail restricted scopes. Slack in your own workspace ≠ Slack distributed to customers for an agent that reads history.
2. **"Production" means more than approval.** Slack shows that a quota or rate-limit gate can make an approved app unusable for agents. So guides have a "For AI agents" nuance section.
3. **Facts change fast** (Spotify Feb 2026, Slack May 2025 → Mar 2026). Every claim needs a date and a source. Guides show `generatedAt` and should be easy to regenerate.
4. **Sources conflict often.** The evidence model needs an explicit `conflict` note on a claim, not a forced single answer.
5. **Vendor and community timelines are useful but lower grade.** Keep them as `community` with ranges. Never present them as official.

## 5. Difficulty tier rubric (used by the agent and the UI)

| Tier | Label | Definition | Typical time to production |
|---|---|---|---|
| 1 | Self-serve | Create the app and go live with no provider review for the target path | minutes–hours |
| 2 | Light review | Some provider check or listing (brand verification, sensitive scopes, marketplace optional but advisable, production key request) | days–2 weeks |
| 3 | Formal review / verification | Required app review or security assessment before real users (restricted scopes, CASA, App Review with screencast) | weeks–months |
| 4 | Gated | Needs business status, a partner program, MAU thresholds, or a paid tier, so a typical new developer may not qualify | uncertain / may be impossible |

The tier is assigned **per path**. The guide's headline tier is the tier of the default path, which is the most common agent-builder use case.
