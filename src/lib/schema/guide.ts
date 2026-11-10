import { z } from "zod";

/**
 * Guide schema: the single source of truth for
 *  - rendering (/guides/[slug])
 *  - the live agent's structured output
 *  - library JSON files in data/guides/
 *
 * Evidence model: every factual statement lives in `claims[]` and is referenced by id.
 */

export const TimeUnit = z.enum(["minutes", "hours", "days", "weeks", "months"]);
export const Range = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  unit: TimeUnit,
  basis: z.string().describe("Where this estimate comes from, e.g. 'Google docs: several weeks; vendor reports 4–8 weeks'"),
});
export type Range = z.infer<typeof Range>;

export const ClaimStatus = z.enum([
  "hands_on", // we tried it ourselves
  "official_doc", // provider's own docs/changelog, with quote
  "probe", // live HTTP check by the agent
  "community", // forums, vendor blogs, anecdotes
  "inferred", // reasoning from other facts, no direct source
  "unknown", // we looked and could not find out
]);
export type ClaimStatus = z.infer<typeof ClaimStatus>;

export const Source = z.object({
  url: z.string(),
  title: z.string().optional(),
  quote: z.string().optional().describe("Verbatim text from the page that supports the claim"),
});

export const Claim = z.object({
  id: z.string(),
  text: z.string(),
  status: ClaimStatus,
  confidence: z.enum(["high", "medium", "low"]),
  sources: z.array(Source).default([]),
  verifiedQuote: z.boolean().optional().describe("Set by the verifier: quote found in fetched page text"),
  conflict: z.string().optional().describe("Sources disagree. Explain how."),
  asOf: z.string().optional().describe("Date the fact was observed or announced (YYYY-MM-DD)"),
});
export type Claim = z.infer<typeof Claim>;

export const Owner = z.enum(["agent", "you", "provider"]);
export type Owner = z.infer<typeof Owner>;

export const Phase = z.enum(["account", "create", "configure", "test", "review", "wait", "launch"]);

export const Link = z.object({ label: z.string(), url: z.string() });

export const Step = z.object({
  id: z.string(),
  phase: Phase,
  title: z.string(),
  owner: Owner,
  detail: z.string(),
  estTime: Range.optional(),
  links: z.array(Link).default([]),
  copyValues: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  gotchas: z.array(z.string()).default([]),
  claimIds: z.array(z.string()).default([]),
});
export type Step = z.infer<typeof Step>;

export const Tier = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export const TIER_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Self-serve",
  2: "Light review",
  3: "Formal review",
  4: "Gated",
};

export const Path = z.object({
  id: z.string(),
  name: z.string(),
  whenThisApplies: z.string(),
  isDefault: z.boolean().default(false),
  tier: Tier,
  timeToFirstLogin: Range,
  timeToProduction: Range,
  activeEffort: Range,
  waitTime: Range,
  cost: z.string().optional(),
  steps: z.array(Step),
  claimIds: z.array(z.string()).default([]),
});
export type Path = z.infer<typeof Path>;

export const Guide = z.object({
  slug: z.string(),
  appName: z.string(),
  website: z.string(),
  logoUrl: z.string().optional(),
  category: z.string().optional(),
  oauthSupported: z.boolean(),
  oauthNotes: z.string().optional(),

  generatedAt: z.string(),
  generator: z.object({
    kind: z.enum(["library", "live"]),
    by: z.string().describe("e.g. 'Claude Code research session' or 'groq/openai/gpt-oss-120b'"),
    pipelineVersion: z.string(),
    durationMs: z.number().optional(),
  }),

  composio: z.object({
    status: z.enum(["managed", "bring_your_own", "not_listed"]),
    toolkitName: z.string().optional(),
    note: z.string(),
    setupGuideUrl: z.string().optional(),
  }),

  summary: z.string(),
  verdict: z.object({
    headline: z.string().describe("One line: the answer a developer wants"),
    biggestRisk: z.string(),
    claimIds: z.array(z.string()).default([]),
  }),

  paths: z.array(Path).min(1),

  requirements: z
    .array(
      z.object({
        item: z.string(),
        detail: z.string(),
        requiredFor: z.array(z.string()).describe("path ids, or ['all']"),
        claimIds: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  nuances: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        forAgents: z.boolean().default(false),
        severity: z.enum(["info", "warn", "blocker"]),
        claimIds: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  blockers: z
    .array(
      z.object({
        symptom: z.string(),
        cause: z.string(),
        fix: z.string(),
        escalation: z.string().optional(),
        claimIds: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  handoffKit: z
    .array(
      z.object({
        kind: z.enum(["form_values", "manifest", "cli", "justification", "composio_config", "checklist", "other"]),
        title: z.string(),
        description: z.string().optional(),
        language: z.string().optional(),
        content: z.string(),
      }),
    )
    .default([]),

  probes: z
    .array(
      z.object({
        check: z.string(),
        target: z.string(),
        result: z.string(),
        ok: z.boolean(),
        at: z.string(),
      }),
    )
    .default([]),

  claims: z.array(Claim),
  unknowns: z.array(z.string()).default([]),
  sources: z
    .array(
      z.object({
        url: z.string(),
        title: z.string(),
        kind: z.enum(["official", "community", "composio", "probe"]),
        fetchedAt: z.string().optional(),
      }),
    )
    .default([]),
});
export type Guide = z.infer<typeof Guide>;
export type GuideInput = z.input<typeof Guide>;

/** Human hands-on verification, stored separately so regeneration never erases it. */
export const VerificationOverlay = z.object({
  slug: z.string(),
  verifiedBy: z.string(),
  attempts: z
    .array(
      z.object({
        date: z.string(),
        what: z.string(),
        outcome: z.string(),
        screenshots: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  claimChecks: z
    .array(
      z.object({
        claimId: z.string().optional(),
        agentSaid: z.string(),
        finding: z.string(),
        result: z.enum(["confirmed", "corrected", "unverifiable"]),
        method: z.enum(["hands_on", "source_check"]),
        source: z.string().optional(),
      }),
    )
    .default([]),
  learned: z.array(z.string()).default([]),
});
export type VerificationOverlay = z.infer<typeof VerificationOverlay>;

// ---------- helpers ----------

const UNIT_MIN: Record<z.infer<typeof TimeUnit>, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
  weeks: 60 * 24 * 7,
  months: 60 * 24 * 30,
};

export function formatRange(r: Range): string {
  const unit = (n: number) => (n === 1 ? r.unit.replace(/s$/, "") : r.unit);
  if (r.min === r.max) return `${r.min} ${unit(r.max)}`;
  if (r.min === 0) return `up to ${r.max} ${unit(r.max)}`;
  return `${r.min}–${r.max} ${unit(r.max)}`;
}

export function rangeMinutes(r: Range) {
  return { min: r.min * UNIT_MIN[r.unit], max: r.max * UNIT_MIN[r.unit] };
}

export function defaultPath(g: Guide): Path {
  return g.paths.find((p) => p.isDefault) ?? g.paths[0];
}
