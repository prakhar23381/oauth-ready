import json, sys
SP = sys.argv[1]
PROBES = json.load(open(f"{SP}/probes.json"))
CB = "https://backend.composio.dev/api/v3/toolkits/auth/callback"
TODAY = "2026-11-11"
BY = "Claude Code research session (WebSearch/WebFetch) + live probes"

def R(a, b, unit, basis): return {"min": a, "max": b, "unit": unit, "basis": basis}
def step(id, phase, owner, title, detail, est=None, links=(), copy=(), gotchas=(), claims=()):
    s = {"id": id, "phase": phase, "title": title, "owner": owner, "detail": detail, "links": [{"label": l, "url": u} for l, u in links],
         "copyValues": [{"label": l, "value": v} for l, v in copy], "gotchas": list(gotchas), "claimIds": list(claims)}
    if est: s["estTime"] = est
    return s
def claim(id, text, status, conf, url, quote=None, title=None, asOf=TODAY, conflict=None):
    src = {"url": url}
    if title: src["title"] = title
    if quote: src["quote"] = quote
    c = {"id": id, "text": text, "status": status, "confidence": conf, "sources": [src], "asOf": asOf}
    if conflict: c["conflict"] = conflict
    return c
CALLBACK = claim("c-composio-callback", f"Composio's redirect URI for custom OAuth apps is {CB}.", "official_doc", "high", "https://docs.composio.dev/docs/custom-auth-configs", CB, "Composio: custom auth configs")
REDIRECT = ("Redirect URI to register (Composio callback)", CB)
def composio_material(app): return {"kind": "composio_config", "title": "Connect the OAuth app to Composio", "content": f"1. In the Composio dashboard, open Auth Configs and create one for {app} using OAuth2 with your own developer credentials.\n2. Enter the client ID and client secret. Set the redirect URI to {CB}\n3. Pass the auth config ID (ac_...) in your session's authConfigs, keyed by toolkit. Creating the auth config alone does not apply it.\nReference: https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app"}
MANAGED = lambda name: f"Composio provides a managed OAuth app for {name}, so development can start without registering your own. A custom OAuth app is needed for your own branding on the consent screen, dedicated quota, or scopes beyond Composio's defaults."

def write(g, source_titles):
    urls = []
    for c in g["claims"]:
        for s in c["sources"]:
            if s["url"] not in urls: urls.append(s["url"])
    g["sources"] = [{"url": u, "title": source_titles.get(u, (u.split("//")[1])[:70]), "kind": ("composio" if "composio.dev" in u else "community" if u in g.pop("_community", []) else "official"), "fetchedAt": TODAY} for u in urls]
    g.pop("_community", None)
    for pth in g["paths"]:
        if pth.get("cost") is None: pth.pop("cost", None)
    g["generatedAt"] = TODAY
    g["generator"] = {"kind": "library", "by": BY, "pipelineVersion": "0.2"}
    json.dump(g, open(f"data/guides/{g['slug']}.json", "w"), indent=2, ensure_ascii=False)
    print("wrote", g["slug"], len(g["claims"]), "claims")

# ============================== SLACK ==============================
S_RL = "https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps"
S_MK = "https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide"
S_DI = "https://docs.slack.dev/distribution"
S_TR = "https://docs.slack.dev/authentication/using-token-rotation"
S_MF = "https://docs.slack.dev/app-manifests/configuring-apps-with-app-manifests"
slack = {
 "slug": "slack", "appName": "Slack", "website": "https://slack.com", "logoUrl": "https://www.google.com/s2/favicons?domain=slack.com&sz=64", "category": "Team messaging",
 "oauthSupported": True, "oauthNotes": "OAuth 2.0 (v2). Apps are created at api.slack.com/apps and are installed per workspace.",
 "composio": {"status": "managed", "toolkitName": "Slack", "note": MANAGED("Slack") + " An agent that reads channel history for customers also needs its own Marketplace-approved app to avoid the reduced rate limits.", "setupGuideUrl": "https://composio.dev/auth/slack"},
 "summary": "A Slack app can be created and distributed to other workspaces without review. An agent that reads message history is a different case: outside the Slack Marketplace, the history methods are limited to one request per minute, so Marketplace approval becomes part of reaching production.",
 "verdict": {"headline": "Testing is available within minutes. An agent that reads message history for customers requires Slack Marketplace approval, which takes up to 12 weeks after 10 active workspaces have installed the app.", "biggestRisk": "Without Marketplace approval, conversations.history and conversations.replies are limited to 1 request per minute and 15 messages per request, which makes history-reading agents impractical.", "claimIds": ["s-rl-tier", "s-rl-1rpm", "s-mk-10weeks", "s-mk-10ws"]},
 "paths": [
  {"id": "marketplace", "name": "Marketplace-listed app for customer workspaces", "whenThisApplies": "The app is sold or distributed commercially and reads channel or thread history. This is the usual case for an AI agent.", "isDefault": True, "tier": 3,
   "timeToFirstLogin": R(10, 20, "minutes", "Create the app from a manifest and install it to a development workspace."),
   "activeEffort": R(8, 20, "hours", "Estimate. Listing content, demo video, test credentials and review responses. No direct source."),
   "waitTime": R(2, 12, "weeks", "Slack: preliminary review up to 10 business days, then functional review up to 10 weeks for new submissions."),
   "timeToProduction": R(3, 14, "weeks", "Review time plus the time needed to reach 10 active workspaces, which Slack requires before submission."),
   "cost": None,
   "steps": [
    step("m1", "create", "agent", "Generate the app manifest", "The agent drafts a manifest with the redirect URL and the minimum bot scopes. See Prepared materials.", R(5, 10, "minutes", "Drafting only."), claims=["s-mf-what"]),
    step("m2", "create", "you", "Create the app from the manifest", "At api.slack.com/apps, choose to create an app from a manifest, paste it, and select a development workspace.", R(5, 10, "minutes", "Console steps."), links=[("Slack app settings", "https://api.slack.com/apps"), ("App manifests", S_MF)], copy=[REDIRECT], claims=["s-mf-ui", "c-composio-callback"]),
    step("m3", "test", "you", "Install to the development workspace and test", "Install the app, copy the client ID and secret into Composio, and run a test connection.", R(10, 20, "minutes", "Console steps."), gotchas=["Decide on token rotation before launch. It cannot be turned off once enabled."], claims=["s-tr-off", "s-tr-never"]),
    step("m4", "configure", "you", "Activate public distribution", "Complete Slack's distribution checklist. All OAuth redirect URLs must use SSL.", R(15, 30, "minutes", "Console steps."), links=[("Distributing Slack apps", S_DI)], claims=["s-di-default", "s-di-ssl"]),
    step("m5", "launch", "you", "Reach 10 active workspaces", "Slack accepts a Marketplace submission only after the app is installed on 10 or more workspaces used in the past 28 days.", gotchas=["During this period the reduced history rate limits apply to every new installation."], claims=["s-mk-10ws", "s-mk-active", "s-rl-new"]),
    step("m6", "review", "agent", "Prepare the Marketplace submission", "The agent drafts the listing text, scope justifications and demo video script. Provide test credentials for your service.", R(3, 6, "hours", "Estimate. No direct source."), claims=["s-mk-video", "s-mk-creds"]),
    step("m7", "review", "you", "Submit the app for review", "Submit from the app settings page. Feedback is returned within the submission flow.", R(30, 60, "minutes", "Console steps."), links=[("Marketplace review guide", S_MK)], claims=["s-mk-feedback"]),
    step("m8", "wait", "provider", "Slack reviews the app", "A preliminary review is followed by a functional review.", R(2, 12, "weeks", "Slack: up to 10 business days, then up to 10 weeks."), claims=["s-mk-10days", "s-mk-10weeks"]),
    step("m9", "launch", "you", "Publish the listing", "Publish from the app settings page once approved.", gotchas=["The published configuration is locked. Changing scopes or features requires resubmission, with up to 6 weeks of review."], claims=["s-mk-locked", "s-mk-6weeks"]),
   ], "claimIds": []},
  {"id": "unlisted", "name": "Distributed app without a Marketplace listing", "whenThisApplies": "The app is installed by other workspaces but does not depend on reading message history, for example it only posts messages.", "isDefault": False, "tier": 1,
   "timeToFirstLogin": R(10, 20, "minutes", "Same setup as the Marketplace path."), "activeEffort": R(1, 2, "hours", "Estimate. No direct source."), "waitTime": R(0, 0, "minutes", "No provider review on this path."), "timeToProduction": R(1, 2, "hours", "Public distribution is activated by the developer without review."), "cost": None,
   "steps": [
    step("u1", "create", "you", "Create the app from a manifest", "Same as steps 1 to 3 of the Marketplace path.", R(20, 40, "minutes", "Console steps."), copy=[REDIRECT], claims=["s-mf-ui", "c-composio-callback"]),
    step("u2", "launch", "you", "Activate public distribution", "Complete the distribution checklist. Other workspaces can then install the app through OAuth.", R(15, 30, "minutes", "Console steps."), gotchas=["Slack states that apps intended for commercial distribution should be submitted to the Marketplace.", "History methods are limited to 1 request per minute on this path."], claims=["s-di-ssl", "s-di-commercial", "s-rl-1rpm"]),
   ], "claimIds": []},
  {"id": "internal", "name": "Internal app for your own workspace", "whenThisApplies": "Only your own organisation uses the app.", "isDefault": False, "tier": 1,
   "timeToFirstLogin": R(10, 20, "minutes", "Create and install."), "activeEffort": R(10, 30, "minutes", "Create and install."), "waitTime": R(0, 0, "minutes", "No provider review on this path."), "timeToProduction": R(10, 30, "minutes", "A new app can be installed in its own workspace immediately."), "cost": None,
   "steps": [
    step("i1", "create", "you", "Create and install the app", "Create the app from a manifest and install it to your workspace. Internal customer-built apps are not affected by the reduced rate limits.", R(10, 30, "minutes", "Console steps."), copy=[REDIRECT], claims=["s-di-default", "s-rl-internal", "c-composio-callback"]),
   ], "claimIds": []},
 ],
 "requirements": [
  {"item": "10 or more active workspaces", "detail": "Installed and used within the past 28 days, before a Marketplace submission is accepted.", "requiredFor": ["marketplace"], "claimIds": ["s-mk-10ws", "s-mk-active"]},
  {"item": "Demo video", "detail": "Required for new submissions and for updates that add functionality or scopes.", "requiredFor": ["marketplace"], "claimIds": ["s-mk-video"]},
  {"item": "Test account credentials", "detail": "Reviewers need credentials to access your service.", "requiredFor": ["marketplace"], "claimIds": ["s-mk-creds"]},
  {"item": "SSL on all redirect URLs", "detail": "Required before public distribution can be activated.", "requiredFor": ["marketplace", "unlisted"], "claimIds": ["s-di-ssl"]},
  {"item": "Support commitment", "detail": "Slack expects listed apps to be maintained and supported.", "requiredFor": ["marketplace"], "claimIds": ["s-mk-support"]},
 ],
 "nuances": [
  {"title": "History methods are limited to 1 request per minute outside the Marketplace", "detail": "For commercially distributed apps not approved for the Marketplace, conversations.history and conversations.replies moved from Tier 3 to Tier 1, with a maximum of 15 messages per request. Marketplace apps and internal apps are exempt.", "forAgents": True, "severity": "blocker", "claimIds": ["s-rl-tier", "s-rl-1rpm", "s-rl-15", "s-rl-mk", "s-rl-internal"]},
  {"title": "Marketplace submission requires 10 active workspaces first", "detail": "The app must be distributed unlisted, under the reduced limits, until it reaches the threshold.", "forAgents": True, "severity": "warn", "claimIds": ["s-mk-10ws", "s-rl-new"]},
  {"title": "Token rotation is irreversible", "detail": "Without rotation, access tokens never expire. With rotation, they expire every 12 hours and refresh tokens are single use. Rotation cannot be turned off once enabled.", "forAgents": True, "severity": "warn", "claimIds": ["s-tr-never", "s-tr-12h", "s-tr-once", "s-tr-off"]},
  {"title": "A published listing is locked", "detail": "Scopes, features and configuration cannot change without resubmission. Reviews of changes take up to 6 weeks.", "forAgents": False, "severity": "warn", "claimIds": ["s-mk-locked", "s-mk-6weeks"]},
  {"title": "Existing installations kept their previous limits", "detail": "The May 2025 changelog states that the reduced limits do not affect existing installations. Later reports describe a March 2026 cut-off for those installations, which this research did not confirm against Slack's documentation.", "forAgents": False, "severity": "info", "claimIds": ["s-rl-existing", "s-rl-2026"]},
 ],
 "blockers": [
  {"symptom": "Frequent 429 responses from conversations.history", "cause": "The app is commercially distributed and not Marketplace-approved, so the method is limited to 1 request per minute.", "fix": "Submit the app to the Marketplace. Until approval, cache results and request at most 15 messages per call.", "claimIds": ["s-rl-1rpm", "s-rl-15"]},
  {"symptom": "Marketplace submission is not accepted", "cause": "The app has fewer than 10 active workspaces.", "fix": "Activate public distribution and onboard workspaces until 10 have used the app within 28 days.", "claimIds": ["s-mk-10ws", "s-mk-active"]},
  {"symptom": "Other workspaces cannot install the app", "cause": "Public distribution is not activated. New apps install only in their own workspace.", "fix": "Complete the distribution checklist in the app settings.", "claimIds": ["s-di-default"]},
 ],
 "handoffKit": [
  {"kind": "manifest", "title": "App manifest (YAML)", "content": "display_information:\n  name: <Your product name>\n  description: <One-line description>\nfeatures:\n  bot_user:\n    display_name: <Your product name>\n    always_online: false\noauth_config:\n  redirect_urls:\n    - " + CB + "\n  scopes:\n    bot:\n      - channels:read\n      - channels:history   # triggers the reduced rate limit outside the Marketplace\n      - chat:write\nsettings:\n  org_deploy_enabled: false\n  socket_mode_enabled: false\n  token_rotation_enabled: false   # cannot be disabled once enabled\n\n# Drafted from the documented manifest structure. Validate with apps.manifest.validate before use."},
  {"kind": "checklist", "title": "Scope selection", "content": "Post messages only: chat:write. No history access, so the reduced rate limits do not apply.\nRead public channel history: channels:history and channels:read.\nRead private channels, DMs or group DMs: groups:history, im:history, mpim:history. Request only those required; each must be justified in review.\nScope names are from Slack's API reference and were not re-verified in this research."},
  {"kind": "justification", "title": "Draft scope justification for channels:history", "content": "<Product> is an assistant that summarises and answers questions about conversations in channels where a workspace member has added it. channels:history is required to read the messages the user asks the assistant to process. The app reads only channels it has been invited to, does not store message content beyond <retention period>, and does not use customer data to train models."},
  composio_material("Slack"),
 ],
 "probes": PROBES["slack"],
 "claims": [
  claim("s-rl-tier", "For commercially distributed apps not approved for the Marketplace, conversations.history and conversations.replies moved from Tier 3 to Tier 1.", "official_doc", "high", S_RL, "are changing from `Tier 3` to `Tier 1` for commercially distributed apps that are not approved for the Slack Marketplace", asOf="2025-05-29"),
  claim("s-rl-1rpm", "Those methods are limited to 1 request per minute unless the app is Marketplace-approved.", "official_doc", "high", S_RL, "will be limited to 1 request per minute, unless they are approved for the Slack Marketplace", asOf="2025-05-29"),
  claim("s-rl-15", "The limit parameter for those methods is capped at 15 objects.", "official_doc", "high", S_RL, "The maximum and default for the `limit` parameter has been reduced to 15 objects.", asOf="2025-05-29"),
  claim("s-rl-mk", "Marketplace apps are not affected.", "official_doc", "high", S_RL, "This change will not impact Marketplace apps.", asOf="2025-05-29"),
  claim("s-rl-internal", "Internal customer-built apps are not affected.", "official_doc", "high", S_RL, "Internal customer-built applications are not impacted by these changes.", asOf="2025-05-29"),
  claim("s-rl-new", "The terms apply immediately to apps created on or after 29 May 2025.", "official_doc", "high", S_RL, "The updated terms are effective immediately for applications created on or after May 29, 2025.", asOf="2025-05-29"),
  claim("s-rl-existing", "The May 2025 changelog states that existing installations are not affected.", "official_doc", "medium", S_RL, "These rate limits will not impact existing installations of these apps.", asOf="2025-05-29", conflict="Secondary sources report that existing installations lost this exemption on 3 March 2026. The changelog page read for this guide does not state that date."),
  claim("s-rl-2026", "Existing installations of non-Marketplace apps were reportedly moved to the reduced limits on 3 March 2026.", "community", "low", "https://api.slack.com/changelog/2025-05-terms-rate-limit-update-and-faq", title="Slack: terms and rate limit FAQ (reported via search summary, not read directly)", asOf="2026-03-03"),
  claim("s-mk-10days", "The preliminary Marketplace review takes up to 10 business days.", "official_doc", "high", S_MK, "the preliminary part of the review takes up to 10 business days to receive feedback"),
  claim("s-mk-10weeks", "The functional review takes up to 10 weeks for new submissions.", "official_doc", "high", S_MK, "the functional review takes up to 10 weeks for new submissions and 6 weeks for published apps resubmitting changes"),
  claim("s-mk-6weeks", "Resubmitted changes to a published app take up to 6 weeks.", "official_doc", "high", S_MK, "the functional review takes up to 10 weeks for new submissions and 6 weeks for published apps resubmitting changes"),
  claim("s-mk-10ws", "A Marketplace submission requires installation on 10 or more active workspaces.", "official_doc", "high", S_MK, "Your app has been installed on 10 or more active workspaces"),
  claim("s-mk-active", "An active workspace is one used in the past 28 days.", "official_doc", "high", S_MK, "An active workspace is a workspace that has been used in the past 28 days."),
  claim("s-mk-video", "A demo video is required for new submissions and for updates that add functionality or scopes.", "official_doc", "high", S_MK, "A short video demo is required for new submissions and for updates that add functionality or scopes."),
  claim("s-mk-creds", "Reviewers require test account credentials for the developer's service.", "official_doc", "high", S_MK, "provide us with test account credentials needed to access your service"),
  claim("s-mk-support", "Slack expects listed apps to be maintained and supported.", "official_doc", "high", S_MK, "You are prepared to maintain your app and to provide good levels of support to the customers who choose to install it."),
  claim("s-mk-feedback", "Review feedback is delivered within the submission flow in the app settings.", "official_doc", "high", S_MK, "You’ll receive our feedback from the review within the submission flow in your app settings"),
  claim("s-mk-locked", "The live version of a published app is locked.", "official_doc", "high", S_MK, "Once your app is published in the Slack Marketplace, the live version of your app is locked."),
  claim("s-di-default", "A new Slack app can be installed only in its own workspace by default.", "official_doc", "high", S_DI, "By default, a newly built Slack app can only be installed in its associated workspace as mentioned above."),
  claim("s-di-ssl", "Public distribution requires SSL on the app's URLs, including OAuth redirect URLs.", "official_doc", "high", S_DI, "Your app must support SSL for all of the following URLs:"),
  claim("s-di-commercial", "Slack states that commercially distributed apps should be submitted to the Marketplace.", "official_doc", "high", S_DI, "apps intended for commercial distribution should be submitted and approved for listing in the Slack Marketplace."),
  claim("s-tr-never", "Without token rotation, access tokens do not expire.", "official_doc", "high", S_TR, "Without token rotation, the access token never expires."),
  claim("s-tr-12h", "With token rotation, access tokens expire every 12 hours.", "official_doc", "high", S_TR, "With token rotation, it expires every 12 hours."),
  claim("s-tr-once", "Refresh tokens are single use.", "official_doc", "high", S_TR, "Refresh tokens are designed to be used once."),
  claim("s-tr-off", "Token rotation cannot be turned off once enabled.", "official_doc", "high", S_TR, "Token rotation may not be turned off once it's turned on"),
  claim("s-mf-what", "App manifests are YAML or JSON configuration bundles for Slack apps.", "official_doc", "high", S_MF, "Manifests are YAML or JSON-formatted configurations bundles for Slack apps."),
  claim("s-mf-ui", "Apps can be created from a manifest in the app settings or through the apps.manifest.create API.", "official_doc", "high", S_MF, "apps.manifest.create is used to create apps from JSON manifests."),
  CALLBACK,
 ],
 "unknowns": ["Whether existing installations of non-Marketplace apps are now under the reduced limits. Secondary sources report a 3 March 2026 cut-off that was not confirmed against Slack's documentation.", "Slack's current rules on using customer data with large language models. The Marketplace review guide read for this guide does not address them.", "The time a typical app needs to reach 10 active workspaces."],
}
write(slack, {S_RL: "Slack changelog: rate limit changes for non-Marketplace apps", S_MK: "Slack Marketplace review guide", S_DI: "Slack: distributing apps", S_TR: "Slack: using token rotation", S_MF: "Slack: configuring apps with app manifests"})

# ============================== GITHUB ==============================
G_DF = "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps"
G_CR = "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app"
G_AU = "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps"
G_OR = "https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions"
G_RL = "https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api"
github = {
 "slug": "github", "appName": "GitHub", "website": "https://github.com", "logoUrl": "https://www.google.com/s2/favicons?domain=github.com&sz=64", "category": "Developer tools",
 "oauthSupported": True, "oauthNotes": "Two app types: OAuth apps and GitHub Apps. Both are registered in Developer settings without review.",
 "composio": {"status": "managed", "toolkitName": "GitHub", "note": MANAGED("GitHub"), "setupGuideUrl": "https://composio.dev/auth/github"},
 "summary": "Registering a GitHub OAuth app is self-service and takes minutes, with no review before any GitHub user can authorise it. The work is in choosing between an OAuth app and a GitHub App, and in handling organisations that restrict OAuth app access by default.",
 "verdict": {"headline": "Testing is available within minutes. Production access requires no review: any GitHub user can authorise the app as soon as it is registered.", "biggestRisk": "New organisations restrict OAuth app access by default, so an organisation owner must approve the app before members can grant it access to organisation resources.", "claimIds": ["g-cr-register", "g-noreview", "g-or-default"]},
 "paths": [
  {"id": "oauth-app", "name": "OAuth app", "whenThisApplies": "The agent acts as the signed-in user across everything that user can access. This is what Composio's GitHub toolkit uses.", "isDefault": True, "tier": 1,
   "timeToFirstLogin": R(5, 10, "minutes", "Registration form only."), "activeEffort": R(15, 30, "minutes", "Registration, credentials and a test authorisation."), "waitTime": R(0, 0, "minutes", "No provider review on this path."), "timeToProduction": R(15, 30, "minutes", "No review step is documented. Registration is self-service."), "cost": None,
   "steps": [
    step("o1", "create", "you", "Register a new OAuth app", "In Settings, open Developer settings, then OAuth apps, and select New OAuth App. Enter the application name, homepage URL and callback URL.", R(5, 10, "minutes", "Console steps."), links=[("Creating an OAuth app", G_CR), ("Developer settings", "https://github.com/settings/developers")], copy=[REDIRECT], gotchas=["Register the app under an organisation account, not a personal one, so ownership does not depend on one person."], claims=["g-cr-register", "g-cr-10cb", "c-composio-callback"]),
    step("o2", "configure", "you", "Generate a client secret", "Generate the secret and add the client ID and secret to a Composio auth config.", R(5, 5, "minutes", "Console steps.")),
    step("o3", "configure", "agent", "Select the minimum scopes", "The agent proposes the narrowest scopes for the tools the product uses. See Prepared materials.", R(5, 10, "minutes", "Drafting only."), claims=["g-df-act"]),
    step("o4", "test", "you", "Run a test authorisation", "Authorise with a test account and confirm the granted scopes. PKCE is supported with the S256 method only.", R(5, 10, "minutes", "Console steps."), claims=["g-au-pkce"]),
   ], "claimIds": []},
  {"id": "github-app", "name": "GitHub App", "whenThisApplies": "The product needs fine-grained, per-repository permissions or short-lived tokens. GitHub recommends this type in general.", "isDefault": False, "tier": 1,
   "timeToFirstLogin": R(15, 30, "minutes", "Estimate. More configuration than an OAuth app. No direct source."), "activeEffort": R(30, 60, "minutes", "Estimate. No direct source."), "waitTime": R(0, 0, "minutes", "No provider review on this path."), "timeToProduction": R(30, 60, "minutes", "Estimate. No review step is documented."), "cost": None,
   "steps": [
    step("a1", "create", "you", "Register a GitHub App", "In Developer settings, register a GitHub App and select its repository and organisation permissions.", R(15, 30, "minutes", "Estimate."), links=[("GitHub Apps and OAuth apps compared", G_DF)], copy=[REDIRECT], claims=["g-df-pref", "g-df-fine", "c-composio-callback"]),
    step("a2", "test", "you", "Install the app and test", "Install the app on an account or organisation you own. Installation access tokens expire after 1 hour.", R(15, 30, "minutes", "Estimate."), gotchas=["Confirm that your integration layer supports GitHub App installation tokens before choosing this type."], claims=["g-df-1h"]),
   ], "claimIds": []},
 ],
 "requirements": [
  {"item": "GitHub account or organisation", "detail": "The app is owned by a user or an organisation. Each can own up to 100 OAuth apps.", "requiredFor": ["all"], "claimIds": ["g-cr-100"]},
  {"item": "Homepage URL", "detail": "Required on the registration form.", "requiredFor": ["all"], "claimIds": ["g-cr-register"]},
  {"item": "HTTPS callback URL", "detail": "Up to 10 callback URLs can be registered.", "requiredFor": ["all"], "claimIds": ["g-cr-10cb"]},
 ],
 "nuances": [
  {"title": "Organisations restrict OAuth apps by default", "detail": "New organisations have OAuth app access restrictions enabled. Members can authorise the app, but it cannot reach organisation resources until an owner approves it.", "forAgents": False, "severity": "warn", "claimIds": ["g-or-default", "g-or-request"]},
  {"title": "Rate limit is 5,000 requests per hour per user", "detail": "OAuth tokens use the authorising user's limit, shared with that user's other tokens. OAuth app limits do not scale with usage.", "forAgents": True, "severity": "warn", "claimIds": ["g-df-5000", "g-df-noscale", "g-rl-shared"]},
  {"title": "Ten tokens per user, app and scope combination", "detail": "Issuing an eleventh token revokes an existing one, so store and reuse tokens.", "forAgents": True, "severity": "warn", "claimIds": ["g-au-10", "g-au-revoke"]},
  {"title": "Token expiry is optional for OAuth apps", "detail": "OAuth apps can be configured to issue user access tokens that expire after eight hours. With expiry enabled, refresh tokens expire after six months without use.", "forAgents": True, "severity": "info", "claimIds": ["g-df-8h", "g-au-6mo"]},
  {"title": "GitHub recommends GitHub Apps", "detail": "GitHub Apps use fine-grained permissions and let the user choose which repositories the app can access.", "forAgents": False, "severity": "info", "claimIds": ["g-df-pref", "g-df-fine"]},
 ],
 "blockers": [
  {"symptom": "Organisation repositories are missing after authorisation", "cause": "The organisation has OAuth app access restrictions enabled and has not approved the app.", "fix": "Ask the user to request approval from an organisation owner on the authorisation screen, or have an owner approve the app in the organisation's third-party access settings.", "claimIds": ["g-or-default", "g-or-request"]},
  {"symptom": "A stored token stops working unexpectedly", "cause": "More than ten tokens were issued for the same user, app and scope combination.", "fix": "Reuse the stored token instead of re-authorising on each run.", "claimIds": ["g-au-10", "g-au-revoke"]},
  {"symptom": "redirect_uri mismatch error", "cause": "The redirect URL's host and port must match the registered callback URL.", "fix": "Register the exact Composio callback URL as a callback URL.", "claimIds": ["g-au-redirect"]},
 ],
 "handoffKit": [
  {"kind": "form_values", "title": "Registration form values", "content": "Application name: <Your product name>\nHomepage URL: https://<yourdomain>\nApplication description: <One-line description shown to users>\nAuthorization callback URL: " + CB + "\nEnable Device Flow: off, unless the product runs without a browser"},
  {"kind": "checklist", "title": "OAuth app or GitHub App", "content": "Choose an OAuth app when: the agent acts as the user everywhere the user has access, and Composio's GitHub toolkit is used as provided.\nChoose a GitHub App when: customers require per-repository access, short-lived tokens (1 hour) or rate limits that scale with the installation.\nGitHub's stated position: GitHub Apps are preferred in general."},
  composio_material("GitHub"),
 ],
 "probes": [
  {"check": "OAuth discovery document", "target": "github.com and common subdomains", "result": "No discovery document at the standard locations checked. Endpoints are taken from the documentation.", "ok": False, "at": TODAY},
  {"check": "Authorization endpoint responds", "target": "https://github.com/login/oauth/authorize", "result": "HTTP 302 for an invalid client ID. The endpoint is live.", "ok": True, "at": TODAY},
 ],
 "claims": [
  claim("g-cr-register", "An OAuth app is registered in Developer settings with a name, homepage URL and callback URL.", "official_doc", "high", G_CR, "Click Register application."),
  claim("g-noreview", "No review or approval step is documented for OAuth apps.", "inferred", "medium", G_CR, title="Creating an OAuth app (no review step is described)"),
  claim("g-cr-100", "A user or organisation can own up to 100 OAuth apps.", "official_doc", "high", G_CR, "A user or organization can own up to 100 OAuth apps."),
  claim("g-cr-10cb", "Up to 10 callback URLs can be registered.", "official_doc", "high", G_CR, "You can enter up to 10 callback URLs."),
  claim("g-df-pref", "GitHub generally prefers GitHub Apps over OAuth apps.", "official_doc", "high", G_DF, "In general, GitHub Apps are preferred over OAuth apps."),
  claim("g-df-fine", "GitHub Apps use fine-grained permissions and give users control over repository access.", "official_doc", "high", G_DF, "GitHub Apps use fine-grained permissions, give the user more control over which repositories the app can access"),
  claim("g-df-act", "OAuth apps act as the authenticated user.", "official_doc", "high", G_DF, "users authorize OAuth apps, which gives the app the ability to act as the authenticated user."),
  claim("g-df-1h", "GitHub App installation access tokens expire after 1 hour.", "official_doc", "high", G_DF, "Installation access tokens expire after a predefined amount of time (currently 1 hour)."),
  claim("g-df-8h", "OAuth apps can be configured to issue user access tokens that expire after eight hours.", "official_doc", "high", G_DF, "You can also configure your OAuth app to use user access tokens that expire after eight hours"),
  claim("g-df-5000", "OAuth tokens use the user's limit of 5,000 requests per hour.", "official_doc", "high", G_DF, "OAuth tokens use the user's rate limit of 5,000 requests per hour."),
  claim("g-df-noscale", "OAuth app rate limits are lower than GitHub App limits and do not scale.", "official_doc", "high", G_DF, "Conversely, OAuth apps have lower rate limits and do not scale."),
  claim("g-rl-shared", "Requests from a user's tokens and authorised apps share one personal limit.", "official_doc", "high", G_RL, "All of these requests count towards your personal rate limit of 5,000 requests per hour."),
  claim("g-au-pkce", "PKCE is supported with the S256 method only.", "official_doc", "high", G_AU, "Must be `S256` - the `plain` code challenge method is not supported."),
  claim("g-au-redirect", "The redirect URL's host and port must match the registered callback URL.", "official_doc", "high", G_AU, "the redirect URL's host (excluding subdomains) and port must exactly match the callback URL"),
  claim("g-au-10", "At most ten tokens are issued per user, application and scope combination.", "official_doc", "high", G_AU, "There is a limit of ten tokens that are issued per user/application/scope combination"),
  claim("g-au-revoke", "When the limit is exceeded, GitHub revokes an existing token.", "official_doc", "high", G_AU, "GitHub revokes one of the existing tokens"),
  claim("g-au-6mo", "Refresh tokens expire after six months without use.", "official_doc", "high", G_AU, "expires after six months without use."),
  claim("g-or-default", "New organisations have OAuth app access restrictions enabled by default.", "official_doc", "high", G_OR, "When you create a new organization, OAuth app access restrictions are enabled by default."),
  claim("g-or-request", "Members can request owner approval for an OAuth app.", "official_doc", "high", G_OR, "Users can request owner approval for OAuth apps they'd like to use"),
  CALLBACK,
 ],
 "unknowns": ["Whether GitHub applies any undocumented review to OAuth apps with large user counts. None is described in the documentation read.", "Whether Composio's GitHub toolkit supports GitHub App installation tokens."],
}
write(github, {G_DF: "GitHub Docs: differences between GitHub Apps and OAuth apps", G_CR: "GitHub Docs: creating an OAuth app", G_AU: "GitHub Docs: authorizing OAuth apps", G_OR: "GitHub Docs: OAuth app access restrictions", G_RL: "GitHub Docs: REST API rate limits"})

# ============================== SPOTIFY ==============================
P_QM = "https://developer.spotify.com/documentation/web-api/concepts/quota-modes"
P_MG = "https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide"
spotify = {
 "slug": "spotify", "appName": "Spotify", "website": "https://spotify.com", "logoUrl": "https://www.google.com/s2/favicons?domain=spotify.com&sz=64", "category": "Music streaming",
 "oauthSupported": True, "oauthNotes": "OAuth 2.0 through the Spotify Developer Dashboard. Every app starts in development mode.",
 "composio": {"status": "bring_your_own", "toolkitName": "Spotify", "note": "Composio lists Spotify as requiring your own OAuth app. Register the app with Spotify, then add its client ID and secret to a Composio auth config.", "setupGuideUrl": "https://composio.dev/auth"},
 "summary": "A Spotify app works within minutes for up to 5 allowlisted users. Serving the public requires extended quota mode, which Spotify grants only to registered organisations with a launched service and at least 250,000 monthly active users.",
 "verdict": {"headline": "Testing is available within minutes for up to 5 allowlisted users. Public access requires extended quota mode, which is open only to organisations with at least 250,000 monthly active users, and its review takes up to six weeks.", "biggestRisk": "Most new products cannot meet the eligibility criteria for extended quota mode, so they remain limited to 5 users.", "claimIds": ["p-dev-5", "p-ext-250k", "p-ext-6w", "p-ext-org"]},
 "paths": [
  {"id": "extended-quota", "name": "Public app in extended quota mode", "whenThisApplies": "Any Spotify user must be able to connect. Requires meeting Spotify's eligibility criteria.", "isDefault": True, "tier": 4,
   "timeToFirstLogin": R(10, 15, "minutes", "Create an app in the dashboard and allowlist a test user."),
   "activeEffort": R(4, 10, "hours", "Estimate. Partner application and supporting material. No direct source."),
   "waitTime": R(1, 6, "weeks", "Spotify: the review can take up to six weeks."),
   "timeToProduction": R(2, 6, "weeks", "Only if the eligibility criteria are met. Otherwise this path is not available."),
   "cost": "Spotify Premium subscription for the app owner while in development mode.",
   "steps": [
    step("e1", "account", "you", "Confirm eligibility before building", "Extended quota mode requires a legally registered organisation, a launched service and at least 250,000 monthly active users.", R(15, 30, "minutes", "Reading the criteria."), links=[("Quota modes", P_QM)], gotchas=["Applications from individuals have not been accepted since 15 May 2025."], claims=["p-ext-org", "p-ext-entity", "p-ext-launched", "p-ext-250k"]),
    step("e2", "create", "you", "Create the app in the Developer Dashboard", "Create the app, add the redirect URI, and note the client ID and secret. The owner account needs Spotify Premium.", R(10, 15, "minutes", "Console steps."), links=[("Developer Dashboard", "https://developer.spotify.com/dashboard")], copy=[REDIRECT], claims=["p-dev-premium", "c-composio-callback"]),
    step("e3", "test", "you", "Allowlist test users and test", "Add each tester to the app's allowlist. Up to 5 users can use the app in development mode.", R(10, 20, "minutes", "Console steps."), gotchas=["Users who are not allowlisted receive HTTP 403."], claims=["p-dev-5", "p-dev-allow", "p-dev-403"]),
    step("e4", "review", "agent", "Prepare the partner application", "The agent drafts the use case description and scope justification. See Prepared materials.", R(2, 4, "hours", "Estimate. No direct source.")),
    step("e5", "review", "you", "Submit the application from a company email", "Submit the partner application. After it is approved, request the move to extended quota mode.", R(30, 60, "minutes", "Form submission."), claims=["p-ext-email", "p-ext-move"]),
    step("e6", "wait", "provider", "Spotify reviews the request", "The review can take up to six weeks.", R(1, 6, "weeks", "Spotify documentation."), claims=["p-ext-6w"]),
   ], "claimIds": []},
  {"id": "development", "name": "Development mode for up to 5 users", "whenThisApplies": "A prototype, internal tool or personal project with a small, known set of users.", "isDefault": False, "tier": 1,
   "timeToFirstLogin": R(10, 15, "minutes", "Create an app and allowlist a user."), "activeEffort": R(15, 30, "minutes", "Console steps."), "waitTime": R(0, 0, "minutes", "No provider review on this path."), "timeToProduction": R(15, 30, "minutes", "Available immediately, limited to 5 allowlisted users."), "cost": "Spotify Premium subscription for the app owner.",
   "steps": [
    step("d1", "create", "you", "Create the app and add the redirect URI", "Create the app in the Developer Dashboard with a Premium account.", R(10, 15, "minutes", "Console steps."), copy=[REDIRECT], claims=["p-dev-premium", "c-composio-callback"]),
    step("d2", "configure", "you", "Add users to the allowlist", "Each user must be added before they can authorise the app.", R(5, 10, "minutes", "Console steps."), claims=["p-dev-allow", "p-dev-5"]),
   ], "claimIds": []},
 ],
 "requirements": [
  {"item": "Spotify Premium for the app owner", "detail": "Development mode apps stop working if the owner's subscription lapses.", "requiredFor": ["all"], "claimIds": ["p-dev-premium", "p-mg-premium"]},
  {"item": "Legally registered organisation", "detail": "Required for extended quota mode. Individuals cannot apply.", "requiredFor": ["extended-quota"], "claimIds": ["p-ext-org", "p-ext-entity"]},
  {"item": "Launched service", "detail": "The product must already be operating.", "requiredFor": ["extended-quota"], "claimIds": ["p-ext-launched"]},
  {"item": "At least 250,000 monthly active users", "detail": "Minimum active user base for extended quota mode.", "requiredFor": ["extended-quota"], "claimIds": ["p-ext-250k"]},
  {"item": "Company email address", "detail": "The application must be sent from one.", "requiredFor": ["extended-quota"], "claimIds": ["p-ext-email"]},
 ],
 "nuances": [
  {"title": "Extended quota mode requires 250,000 monthly active users", "detail": "The threshold applies together with the organisation and launched-service criteria. A product that cannot meet it is limited to 5 users.", "forAgents": False, "severity": "blocker", "claimIds": ["p-ext-250k", "p-ext-entity", "p-ext-launched"]},
  {"title": "Development mode is capped at 5 allowlisted users", "detail": "Each user must be added to the allowlist. Apps created before February 2026 keep their earlier limits.", "forAgents": False, "severity": "warn", "claimIds": ["p-dev-5", "p-dev-allow", "p-mg-grandfather"]},
  {"title": "Web API endpoints were removed in February 2026", "detail": "Batch endpoints are no longer available and playlist track endpoints were renamed. New apps were affected from 11 February 2026 and existing apps from 9 March 2026.", "forAgents": True, "severity": "warn", "claimIds": ["p-mg-batch", "p-mg-rename"]},
  {"title": "Client ID limit changed twice in 2026", "detail": "New developers were limited to one Client ID in February 2026. The limit was raised to 25 in July 2026.", "forAgents": False, "severity": "info", "claimIds": ["p-mg-25"]},
  {"title": "Extended quota mode has a higher rate limit", "detail": "Development mode apps have a lower rate limit than extended quota mode apps.", "forAgents": True, "severity": "info", "claimIds": ["p-ext-rate"]},
 ],
 "blockers": [
  {"symptom": "A user receives HTTP 403 after authorising", "cause": "The user is not on the app's allowlist, or the 5-user cap is reached.", "fix": "Add the user in the Developer Dashboard. Beyond 5 users, extended quota mode is required.", "claimIds": ["p-dev-403", "p-dev-5"]},
  {"symptom": "The app stops working for all users", "cause": "The owner's Spotify Premium subscription lapsed.", "fix": "Renew the subscription on the owner account.", "claimIds": ["p-mg-premium"]},
  {"symptom": "Extended quota application is not accepted", "cause": "The applicant is an individual or does not meet the user threshold.", "fix": "Apply as a registered organisation from a company email once the criteria are met. No alternative route is documented.", "claimIds": ["p-ext-org", "p-ext-250k"]},
 ],
 "handoffKit": [
  {"kind": "form_values", "title": "Developer Dashboard values", "content": "App name: <Your product name>\nApp description: <One-line description>\nWebsite: https://<yourdomain>\nRedirect URI: " + CB + "\nAPIs used: Web API"},
  {"kind": "justification", "title": "Draft use case description", "content": "<Product> lets a user control playback and manage their own playlists through an assistant. It requests only the scopes needed for the features the user enables, acts only on that user's account, and does not use Spotify content to train machine learning models. <Confirm this statement against Spotify's Developer Terms before submitting.>"},
  composio_material("Spotify"),
 ],
 "probes": PROBES["spotify"],
 "claims": [
  claim("p-dev-5", "Up to 5 authenticated users can use an app in development mode.", "official_doc", "high", P_QM, "Up to 5 authenticated Spotify users can use an app that is in development mode"),
  claim("p-dev-allow", "Each user must be added to the app's allowlist.", "official_doc", "high", P_QM, "Each Spotify user who installs your app will need to be added to your app's allowlist before they can use it."),
  claim("p-dev-premium", "The app owner must have Spotify Premium for a development mode app to function.", "official_doc", "high", P_QM, "The app owner must have a Spotify Premium account for apps in development mode to function."),
  claim("p-dev-403", "Requests for users who are not allowlisted receive HTTP 403.", "official_doc", "high", P_QM, "API requests with an access token associated to that user and app will receive a 403 status code error."),
  claim("p-ext-org", "Since 15 May 2025, Spotify accepts extended quota applications only from organisations.", "official_doc", "high", P_QM, "Please note that as of May 15th 2025, Spotify only accepts applications from organizations (not individuals).", asOf="2025-05-15"),
  claim("p-ext-entity", "Applicants must be a legally registered business or organisation.", "official_doc", "high", P_QM, "Established Business Entity (legally registered business or organisation)"),
  claim("p-ext-launched", "Applicants must operate an active, launched service.", "official_doc", "high", P_QM, "Operating an active, and Launched Service"),
  claim("p-ext-250k", "Applicants must have at least 250,000 monthly active users.", "official_doc", "high", P_QM, "Maintaining a minimum of active users (at least 250k MAUs)"),
  claim("p-ext-email", "The application must be sent from a company email address.", "official_doc", "high", P_QM, "Application must be sent through a company email"),
  claim("p-ext-move", "After approval, the developer asks Spotify to move the app into extended quota mode.", "official_doc", "high", P_QM, "you can ask Spotify to move your app from development mode into extended quota mode."),
  claim("p-ext-6w", "The review can take up to six weeks.", "official_doc", "high", P_QM, "This review process can take up to six weeks."),
  claim("p-ext-rate", "Extended quota mode apps have a higher rate limit.", "official_doc", "high", P_QM, "Extended quota mode apps also have access to a higher rate limit than development mode apps do."),
  claim("p-mg-premium", "All development mode apps require an active Premium subscription on the owner account.", "official_doc", "high", P_MG, "All Development Mode apps require the app owner to have an active Spotify Premium subscription.", asOf="2026-02-11"),
  claim("p-mg-25", "The Client ID limit per developer was raised to 25 in July 2026.", "official_doc", "high", P_MG, "As of July 2026, the Client IDs per developer limit has been increased to 25.", asOf="2026-07", conflict="The February 2026 announcement set the limit at one Client ID per developer. Articles written before July 2026 still state one."),
  claim("p-mg-grandfather", "Apps with more than 5 users or multiple Client IDs before the change retain them.", "official_doc", "high", P_MG, "Existing apps are grandfathered: If you already have multiple Client IDs or more than 5 users, you will retain them."),
  claim("p-mg-batch", "Batch endpoints are no longer available.", "official_doc", "high", P_MG, "The following batch endpoints are no longer available. Fetch items individually instead.", asOf="2026-02-11"),
  claim("p-mg-rename", "Playlist track endpoints were renamed from /tracks to /items.", "official_doc", "high", P_MG, "The playlist track management endpoints have been renamed from `/tracks` to `/items`:", asOf="2026-02-11"),
  CALLBACK,
 ],
 "unknowns": ["Whether Spotify's Developer Terms restrict use of its content with AI models. The terms were not read for this guide.", "Access and refresh token lifetimes. The pages read do not state them.", "The numeric rate limits for development mode and extended quota mode. Spotify does not publish them on the pages read.", "How strictly the 250,000 monthly active user threshold is applied in practice."],
}
write(spotify, {P_QM: "Spotify for Developers: quota modes", P_MG: "Spotify for Developers: February 2026 migration guide"})

# ============================== OUTLOOK ==============================
M_PV = "https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview"
M_RT = "https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens"
M_RG = "https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app"
M_PC = "https://learn.microsoft.com/en-us/entra/identity-platform/permissions-consent-overview"
outlook = {
 "slug": "outlook", "appName": "Outlook (Microsoft Graph)", "website": "https://outlook.com", "logoUrl": "https://www.google.com/s2/favicons?domain=outlook.com&sz=64", "category": "Email and calendar",
 "oauthSupported": True, "oauthNotes": "OAuth 2.0 and OpenID Connect through the Microsoft identity platform. Apps are registered in Microsoft Entra ID and call Microsoft Graph.",
 "composio": {"status": "managed", "toolkitName": "Outlook", "note": MANAGED("Outlook"), "setupGuideUrl": "https://composio.dev/auth"},
 "summary": "Registering an app in Microsoft Entra ID is immediate and has no review. For a multitenant app, the practical requirement is publisher verification: without it, users in other organisations are often unable to consent. Verification is free and takes minutes once a verified Microsoft partner account exists.",
 "verdict": {"headline": "Testing is available within minutes. Production access for users in other organisations requires publisher verification, which completes in minutes once a verified Microsoft AI Cloud Partner Program account and a custom domain are in place.", "biggestRisk": "Where risk-based step-up consent is enabled, users cannot consent to a multitenant app from an unverified publisher, and many organisations require administrator consent regardless.", "claimIds": ["m-pv-nov2020", "m-pv-minutes", "m-pv-cpp", "m-pc-admin"]},
 "paths": [
  {"id": "multitenant", "name": "Multitenant app for other organisations", "whenThisApplies": "Users in any Microsoft Entra tenant, and optionally personal Microsoft accounts, connect their mailbox. This is the usual case for a SaaS agent.", "isDefault": True, "tier": 2,
   "timeToFirstLogin": R(10, 20, "minutes", "App registration and a test sign-in in your own tenant."),
   "activeEffort": R(2, 6, "hours", "Estimate. Partner account enrolment, domain verification and configuration. No direct source."),
   "waitTime": R(1, 7, "days", "Estimate. Microsoft states that verification completes in minutes once the prerequisites are met. The time to verify a new partner account is not stated in the sources read."),
   "timeToProduction": R(1, 7, "days", "Estimate. Depends on whether a verified partner account already exists."),
   "cost": "No charge for publisher verification. An Azure account with an active subscription is listed as a prerequisite for registration.",
   "steps": [
    step("t1", "account", "you", "Use a work or school account in an Entra tenant", "Register the app with a Microsoft Entra work or school account. Apps registered with a personal Microsoft account cannot be publisher verified.", R(5, 15, "minutes", "Account setup."), claims=["m-pv-work", "m-rg-prereq"]),
    step("t2", "create", "you", "Register the application", "In the Microsoft Entra admin centre, open App registrations and select New registration. Choose a multitenant account type.", R(5, 10, "minutes", "Console steps."), links=[("Register an application", M_RG), ("Microsoft Entra admin centre", "https://entra.microsoft.com")], gotchas=["The application cannot be moved between tenants after creation."], claims=["m-rg-steps", "m-rg-multi", "m-rg-move"]),
    step("t3", "configure", "you", "Add the redirect URI and a client secret", "Add a Web platform redirect URI and create a client secret. Add both to a Composio auth config.", R(5, 10, "minutes", "Console steps."), copy=[REDIRECT], claims=["c-composio-callback"]),
    step("t4", "configure", "agent", "Select delegated permissions", "The agent proposes the narrowest Microsoft Graph delegated permissions. High-privilege permissions require administrator consent.", R(10, 20, "minutes", "Drafting only."), links=[("Permissions and consent", M_PC)], claims=["m-pc-delegated", "m-pc-admin"]),
    step("t5", "review", "you", "Enrol in the Microsoft AI Cloud Partner Program", "Create or use the organisation's partner global account and complete its verification.", gotchas=["The partner account's email domain must match the app's publisher domain or a DNS-verified custom domain.", "The publisher domain cannot be an onmicrosoft.com domain."], claims=["m-pv-cpp", "m-pv-domain", "m-pv-onms"]),
    step("t6", "wait", "provider", "Microsoft verifies the partner account", "Verification of a new partner account is handled by Microsoft Partner Center.", R(1, 7, "days", "Estimate. Not stated in the sources read.")),
    step("t7", "launch", "you", "Mark the app as publisher verified", "Associate the verified Partner ID with the app registration, signed in with multifactor authentication.", R(5, 15, "minutes", "Microsoft: verified in minutes once requirements are met."), claims=["m-pv-minutes", "m-pv-mfa", "m-pv-roles"]),
   ], "claimIds": []},
  {"id": "single-tenant", "name": "Single-tenant app for your own organisation", "whenThisApplies": "Only users in your own Microsoft Entra tenant use the app.", "isDefault": False, "tier": 1,
   "timeToFirstLogin": R(10, 20, "minutes", "App registration and sign-in."), "activeEffort": R(15, 30, "minutes", "Console steps."), "waitTime": R(0, 0, "minutes", "No provider review on this path."), "timeToProduction": R(15, 30, "minutes", "No verification is needed inside your own tenant."), "cost": None,
   "steps": [
    step("n1", "create", "you", "Register a single-tenant application", "Microsoft recommends the single-tenant option for most applications.", R(5, 10, "minutes", "Console steps."), copy=[REDIRECT], claims=["m-rg-single", "c-composio-callback"]),
    step("n2", "configure", "you", "Grant administrator consent", "An administrator grants consent once for the organisation.", R(5, 10, "minutes", "Console steps."), claims=["m-pc-admin"]),
   ], "claimIds": []},
 ],
 "requirements": [
  {"item": "Microsoft Entra tenant with a work or school account", "detail": "The registering account needs at least the Application Developer role.", "requiredFor": ["all"], "claimIds": ["m-rg-prereq", "m-pv-work"]},
  {"item": "Verified Microsoft AI Cloud Partner Program account", "detail": "It must be the organisation's partner global account.", "requiredFor": ["multitenant"], "claimIds": ["m-pv-cpp"]},
  {"item": "Custom verified domain", "detail": "Set as the app's publisher domain. An onmicrosoft.com domain is not accepted.", "requiredFor": ["multitenant"], "claimIds": ["m-pv-domain", "m-pv-onms"]},
  {"item": "Multifactor authentication", "detail": "Required for the user who initiates verification.", "requiredFor": ["multitenant"], "claimIds": ["m-pv-mfa"]},
  {"item": "Administrator roles in Entra ID and Partner Center", "detail": "Application Administrator or Cloud Application Administrator, and CPP Partner Admin or Account Admin.", "requiredFor": ["multitenant"], "claimIds": ["m-pv-roles"]},
 ],
 "nuances": [
  {"title": "Unverified publishers are blocked from user consent", "detail": "Where risk-based step-up consent is enabled, users cannot consent to most multitenant apps registered after 8 November 2020 that are not publisher verified and request more than basic sign-in.", "forAgents": False, "severity": "blocker", "claimIds": ["m-pv-nov2020"]},
  {"title": "Administrators may need to consent", "detail": "Application permissions and many high-privilege delegated permissions can be granted only by an administrator.", "forAgents": False, "severity": "warn", "claimIds": ["m-pc-admin"]},
  {"title": "Refresh tokens last 90 days", "detail": "The default lifetime is 90 days, or 24 hours for single-page applications. Each use returns a replacement token.", "forAgents": True, "severity": "warn", "claimIds": ["m-rt-90", "m-rt-replace"]},
  {"title": "Refresh tokens can be revoked at any time", "detail": "The sign-in service can revoke tokens before expiry, for example after an administrator action. The agent must handle re-authentication.", "forAgents": True, "severity": "warn", "claimIds": ["m-rt-revoke"]},
  {"title": "Publisher verification is free", "detail": "Microsoft does not charge for it and no licence is required.", "forAgents": False, "severity": "info", "claimIds": ["m-pv-free"]},
 ],
 "blockers": [
  {"symptom": "Users see an unverified publisher warning and cannot consent", "cause": "The app is multitenant and not publisher verified.", "fix": "Complete publisher verification. Until then, ask a tenant administrator to grant consent.", "claimIds": ["m-pv-nov2020"]},
  {"symptom": "Consent prompt requires an administrator", "cause": "The requested permissions are high privilege, or the tenant restricts user consent.", "fix": "Reduce the requested permissions, or provide the customer's administrator with an admin consent link.", "claimIds": ["m-pc-admin"]},
  {"symptom": "Publisher verification fails on domain", "cause": "The partner account's email domain does not match the publisher domain, or the publisher domain is an onmicrosoft.com domain.", "fix": "Add and DNS-verify a custom domain in the tenant and set it as the publisher domain.", "claimIds": ["m-pv-domain", "m-pv-onms"]},
 ],
 "handoffKit": [
  {"kind": "cli", "title": "Register the app with Azure CLI", "content": "az ad app create \\\n  --display-name \"<Your product name>\" \\\n  --sign-in-audience AzureADandPersonalMicrosoftAccount \\\n  --web-redirect-uris " + CB + "\n\n# Drafted from the Azure CLI reference, not executed. Confirm the flags with: az ad app create --help"},
  {"kind": "form_values", "title": "App registration values", "content": "Name: <Your product name>\nSupported account types: Any Entra ID tenant + personal Microsoft accounts (or Multiple Entra ID tenants for work accounts only)\nRedirect URI (Web): " + CB + "\nPublisher domain: <yourdomain> (custom, DNS verified)"},
  {"kind": "checklist", "title": "Permission selection", "content": "Request delegated permissions only, and the narrowest that work.\nRead mail: Mail.Read. Send mail: Mail.Send. Read and write mail: Mail.ReadWrite.\nCalendar: Calendars.Read or Calendars.ReadWrite.\nInclude offline_access to receive refresh tokens.\nPermission names are from the Microsoft Graph reference and were not re-verified in this research."},
  composio_material("Outlook"),
 ],
 "probes": [
  {"check": "OAuth discovery document", "target": "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration", "result": "Found. Authorization endpoint: https://login.microsoftonline.com/common/oauth2/v2.0/authorize. Token endpoint: https://login.microsoftonline.com/common/oauth2/v2.0/token.", "ok": True, "at": TODAY},
  {"check": "PKCE support", "target": "code_challenge_methods_supported", "result": "Not advertised in the discovery document.", "ok": False, "at": TODAY},
  {"check": "Dynamic client registration", "target": "registration_endpoint", "result": "Not advertised. The app must be registered in the Entra admin centre, CLI or Graph API.", "ok": False, "at": TODAY},
 ],
 "claims": [
  claim("m-pv-nov2020", "With risk-based step-up consent enabled, users cannot consent to most newly registered multitenant apps that are not publisher verified.", "official_doc", "high", M_PV, "Beginning November 2020, if risk-based step-up consent is enabled, users can't consent to most newly registered multitenant apps that aren't publisher verified."),
  claim("m-pv-minutes", "Developers who already meet the requirements can be verified in minutes.", "official_doc", "high", M_PV, "Developers who have already met these requirements can be verified in minutes."),
  claim("m-pv-cpp", "Verification requires a verified Microsoft AI Cloud Partner Program account that is the organisation's partner global account.", "official_doc", "high", M_PV, "The CPP account must be the partner global account (PGA) for the developer's organization."),
  claim("m-pv-work", "Apps registered with a personal Microsoft account cannot be publisher verified.", "official_doc", "high", M_PV, "Apps that are registered by using a Microsoft account can't be publisher verified."),
  claim("m-pv-domain", "The partner account's email domain must match the publisher domain or a DNS-verified custom domain.", "official_doc", "high", M_PV, "The domain of the email address that's used during CPP account verification must either match the publisher domain that's set for the app or be a DNS-verified custom domain that's added to the Microsoft Entra tenant."),
  claim("m-pv-onms", "The publisher domain cannot be an onmicrosoft.com domain.", "official_doc", "high", M_PV, "the app's publisher domain can't be *.onmicrosoft.com to be publisher verified"),
  claim("m-pv-mfa", "The user who initiates verification must sign in with multifactor authentication.", "official_doc", "high", M_PV, "The user who initiates verification must sign in by using Microsoft Entra multifactor authentication."),
  claim("m-pv-roles", "The initiating user needs administrator roles in both Entra ID and Partner Center.", "official_doc", "high", M_PV, "The user who initiates the verification must have one of the required roles in both Microsoft Entra ID and Partner Center."),
  claim("m-pv-free", "Microsoft does not charge for publisher verification.", "official_doc", "high", M_PV, "Microsoft doesn't charge developers for publisher verification. No license is required to become a verified publisher."),
  claim("m-rg-prereq", "Registration requires an Azure account with an active subscription and at least the Application Developer role.", "official_doc", "high", M_RG, "The Azure account must be at least an Application Developer."),
  claim("m-rg-steps", "Apps are registered under App registrations in the Microsoft Entra admin centre.", "official_doc", "high", M_RG, "Browse to Entra ID > App registrations and select New registration."),
  claim("m-rg-multi", "The multitenant account type lets users in any Microsoft Entra tenant use the application.", "official_doc", "high", M_RG, "For multitenant apps when you want users in any Microsoft Entra tenant to be able to use your application."),
  claim("m-rg-single", "Microsoft recommends the single-tenant option for most applications.", "official_doc", "high", M_RG, "We recommend Single tenant only - <your tenant> for most applications."),
  claim("m-rg-move", "An application object cannot be moved between tenants.", "official_doc", "high", M_RG, "Once created, you can't move the application object between different tenants."),
  claim("m-pc-delegated", "Delegated permissions let the application act on a user's behalf, limited to what that user can access.", "official_doc", "high", M_PC, "The application isn't able to access anything the signed in user couldn't access."),
  claim("m-pc-admin", "Application permissions and many high-privilege delegated permissions require administrator consent.", "official_doc", "high", M_PC, "application permissions and many high-privilege delegated permissions can only be consented to by an administrator."),
  claim("m-rt-90", "The default refresh token lifetime is 90 days, or 24 hours for single-page applications.", "official_doc", "high", M_RT, "90 days for all other scenarios."),
  claim("m-rt-replace", "Refresh tokens replace themselves on every use.", "official_doc", "high", M_RT, "Refresh tokens replace themselves with a fresh token upon every use."),
  claim("m-rt-revoke", "Refresh tokens can be revoked by the sign-in service at any time.", "official_doc", "high", M_RT, "they can be revoked by the sign-in service at any time before their expiration."),
  CALLBACK,
 ],
 "unknowns": ["How long Microsoft takes to verify a new AI Cloud Partner Program account. The sources read give no figure.", "Microsoft Graph throttling limits for mail. They were not read for this guide.", "Whether Microsoft's terms restrict use of Graph data with AI models. The terms were not read for this guide.", "Whether a paid Azure subscription is needed in practice. The quickstart lists an active subscription as a prerequisite and links to a free account."],
}
write(outlook, {M_PV: "Microsoft Learn: publisher verification overview", M_RT: "Microsoft Learn: refresh tokens", M_RG: "Microsoft Learn: register an application", M_PC: "Microsoft Learn: permissions and consent overview"})
