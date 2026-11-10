import type { ClaimStatus, Owner } from "@/lib/schema/guide";

/** Semantic tones only where they carry literal meaning (DESIGN.md §3). */
export type Tone = "neutral" | "success" | "warning" | "destructive";

export const TIER_META: Record<1 | 2 | 3 | 4, { label: string; blurb: string; tone: Tone }> = {
  1: { label: "Self-serve", blurb: "No provider review on this path", tone: "success" },
  2: { label: "Light review", blurb: "A provider check or listing, usually days", tone: "neutral" },
  3: { label: "Formal review", blurb: "Required review or security assessment, usually weeks", tone: "warning" },
  4: { label: "Gated", blurb: "Business status, partnership, MAU or paid tier required", tone: "destructive" },
};

export const OWNER_META: Record<Owner, { label: string; short: string; emoji: string }> = {
  agent: { label: "The agent can do or prepare this", short: "Agent", emoji: "🤖" },
  you: { label: "You must do this", short: "You", emoji: "👤" },
  provider: { label: "Waiting on the provider", short: "Wait", emoji: "⏳" },
};

export const STATUS_META: Record<ClaimStatus, { label: string; chip: string; description: string; tone: Tone; rank: number }> = {
  hands_on: { label: "Hands-on verified", chip: "Tested", description: "We tried this ourselves", tone: "success", rank: 0 },
  official_doc: { label: "Official docs", chip: "Doc", description: "Provider documentation, with a quote", tone: "neutral", rank: 1 },
  probe: { label: "Live probe", chip: "Probe", description: "Automated HTTP check by the agent", tone: "neutral", rank: 2 },
  community: { label: "Community report", chip: "Community", description: "Forums, vendor blogs, anecdotes", tone: "warning", rank: 3 },
  inferred: { label: "Inferred", chip: "Inferred", description: "Reasoned from other facts, no direct source", tone: "neutral", rank: 4 },
  unknown: { label: "Unknown", chip: "Unknown", description: "We looked and couldn't find out", tone: "neutral", rank: 5 },
};

export const PHASE_LABEL: Record<string, string> = {
  account: "Account", create: "Create app", configure: "Configure", test: "Test", review: "Review", wait: "Wait", launch: "Launch",
};

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border text-muted-foreground",
  success: "border-success/50 text-success",
  warning: "border-warning/50 text-warning",
  destructive: "border-destructive/50 text-destructive",
};
export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};
