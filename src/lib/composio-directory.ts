// Source: https://docs.composio.dev/toolkits/managed-auth (fetched 2026-11-11).
// Display names only; matched by normalized name. Programmatic source of truth is the
// toolkit endpoint's `composio_managed_auth_schemes` (needs a Composio API key; not used here).

export const COMPOSIO_DIRECTORY_SOURCE = "https://docs.composio.dev/toolkits/managed-auth";
export const COMPOSIO_DIRECTORY_FETCHED_AT = "2026-11-11";
export const COMPOSIO_CALLBACK_URL = "https://backend.composio.dev/api/v3/toolkits/auth/callback";

const MANAGED = `Aircall, Airtable, Amazon, Apaleo, Asana, Attio, Basecamp, Bitbucket, Blackbaud, Boldsign, Box, Cal, Calendly, Canva, Capsule CRM, ClickUp, Confluence, Contentful, Crowdin, Dart, Daytona, Dialpad, Discord, Discord Bot, Dropbox, Dub, Dynamics 365, Eventbrite, Excel, Exist, Facebook, Fathom, Figma, Freeagent, FreshBooks, GitHub, GitLab, Gmail, Gong, Google Ads, Google Analytics, Google BigQuery, Google Calendar, Google Classroom, Google Docs, Google Drive, Google Maps, Google Meet, Google Photos, Google Search Console, Google Sheets, Google Slides, Google Super, Google Tasks, Gorgias, Greenhouse, Gumroad, Harvest, HubSpot, Hugging Face, Instagram, Intercom, Jira, Kit, Linear, LinkedIn, Linkhut, Mailchimp, Microsoft OneNote, Microsoft Teams, Miro, Monday, Moneybird, Mural, NotebookLM, Notion, Omnisend, OneDrive, Outlook, PagerDuty, Pinterest, Pinterest Ads, Prisma, Productboard, Pushbullet, QuickBooks, Reddit, Reddit Ads, Roam, Salesforce, Sentry, Servicem8, SharePoint, Shippo, Slack, Slackbot, Splitwise, Square, Stack Exchange, Stripe, Supabase, Ticketmaster, Ticktick, TikTok Ads, Timely, Todoist, Trello, Twitch, Typeform, WakaTime, Webex, WhatsApp, Wrike, Yandex, YNAB, YouTube, Zendesk, Zeplin, Zoho, Zoho Bigin, Zoho Books, Zoho Desk, Zoho Inventory, Zoho Invoice, Zoho Mail, Zoom`;

const BRING_YOUR_OWN = `AdRoll, Aha!, Ahrefs, Alpaca, AWeber, Azure Monitor Activity Log, BambooHR, Beeminder, bexio, Bitly, Bitwarden, Blackboard, Borneo, Brevo, Brex, Buffer, Canvas, CleverReach, ClickFunnels 2.0, Clio Manage, Clockify, Cloud 66, Clover, Commerce Layer, Constant Contact, Contacts+, Coupa, Cradl AI, D2L Brightspace, Databricks, Datadog, dbt Cloud, Deel, Deputy, DevCycle, DigitalOcean, Disqus, DocuSign, Dribbble, Dropbox Sign, Dynatrace, eBay, Egnyte, Epic Games, Follow Up Boss, Frame.io V4, freee, Freshsales, Front, Gagelist, GetResponse, Google Admin, Google AdSense, Google Business Profile, Google Chat, Google Data Studio, Google Merchant Center, Googlecontacts, Googleforms, GoTo Training, Gusto, HaloPSA, Help Scout, HighLevel Agency, HighLevel Location, Imply Polaris, Infisical, Ironclad, Jibble, Jobber, Judge.me, Kick, Kintone REST, Klaviyo, Kommo, LaunchDarkly, Lever, Lightspeed Retail X-Series, Linkedin Ads, Linode, LiveChat, Lodgify, MailUp, Matterport, Meta Ads, Microsoft Advertising, Microsoft Bookings, Microsoft Entra ID, Microsoft Power Bi, Microsoft PowerPoint, Microsoft To Do, Microsoft Word, Money Forward, MongoDB, Neo4J, Neon, Netsuite, Parma, Paypal, PayPal Zettle, Personio, Pinecone, Pipedrive, PlanetScale, Podio, Polar, Quire, Railway, Ramp, Razorpay, RD Station Marketing, Rebrandly, Recruitee, Reloadly, Resend, Rillet, Sage Intacct, Salesforce Data 360, Salesforce Service Cloud, Scheduleonce, Sendloop, SendPulse, ServiceNow, ServiceTitan, SharePoint Graph, Shopify, SignNow, Smartsheet, Smokeball, Snapchat, Snowflake, Snyk, SoundCloud, Spotify, Storyblok, SurveyMonkey, Tally, Teamleader Focus, Threads, Tiktok, Toneden, Twilio, Twitter, Vercel, Vibe, Vimeo, Webflow, Whop, WildApricot, Wix, WordPress.com, Workable, Workday, Xero, Zoho Calendar, Zoho Campaigns, Zoho People, Zoho Projects, Zoho Recruit, Zoho Sign, Zoho WorkDrive, Zoom Team Chat, Zoominfo`;

const ALIASES: Record<string, string> = { x: "twitter", "google mail": "gmail", "microsoft outlook": "outlook", "microsoft teams": "microsoft teams", "office 365": "outlook", "jira cloud": "jira", meta: "facebook" };

export const normalizeAppName = (s: string) =>
  s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\.(com|io|dev|app|co|org|net)(\/.*)?$/, "").replace(/[^a-z0-9+! ]/g, " ").replace(/\s+/g, " ").trim();

const toSet = (csv: string) => new Map(csv.split(",").map((n) => [normalizeAppName(n), n.trim()]));
const managed = toSet(MANAGED);
const byo = toSet(BRING_YOUR_OWN);

export type ComposioStatus =
  | { status: "managed"; toolkitName: string }
  | { status: "bring_your_own"; toolkitName: string }
  | { status: "not_listed" };

export function lookupComposio(appNameOrDomain: string): ComposioStatus {
  const n0 = normalizeAppName(appNameOrDomain);
  const n = ALIASES[n0] ?? n0;
  if (managed.has(n)) return { status: "managed", toolkitName: managed.get(n)! };
  if (byo.has(n)) return { status: "bring_your_own", toolkitName: byo.get(n)! };
  return { status: "not_listed" };
}
