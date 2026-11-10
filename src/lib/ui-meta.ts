import type { ClaimStatus, Owner } from "@/lib/schema/guide";

/** Semantic tones only where they carry literal meaning (DESIGN.md §3). */
export type Tone = "neutral" | "success" | "warning" | "destructive";

export const TIER_META: Record<1 | 2 | 3 | 4, { label: string; blurb: string; tone: Tone }> = {
  1: { label: "Self-serve", blurb: "No provider review is required on this path.", tone: "success" },
  2: { label: "Light review", blurb: "A provider check or listing is required. Typically takes days.", tone: "neutral" },
  3: { label: "Formal review", blurb: "A formal review or security assessment is required. Typically takes weeks.", tone: "warning" },
  4: { label: "Gated", blurb: "Access depends on business status, a partner programme, usage thresholds or a paid tier.", tone: "destructive" },
};

export const OWNER_META: Record<Owner, { label: string; short: string; emoji: string }> = {
  agent: { label: "Can be prepared by the agent", short: "Agent", emoji: "🤖" },
  you: { label: "Requires your action", short: "You", emoji: "👤" },
  provider: { label: "Provider review period", short: "Wait", emoji: "⏳" },
};

export const STATUS_META: Record<ClaimStatus, { label: string; chip: string; description: string; tone: Tone; rank: number }> = {
  hands_on: { label: "Hands-on verified", chip: "Tested", description: "Confirmed through a hands-on setup attempt.", tone: "success", rank: 0 },
  official_doc: { label: "Official docs", chip: "Doc", description: "Stated in the provider's documentation, with a supporting quote.", tone: "neutral", rank: 1 },
  probe: { label: "Live probe", chip: "Probe", description: "Confirmed by an automated request to the provider's endpoints.", tone: "neutral", rank: 2 },
  community: { label: "Community report", chip: "Community", description: "Reported in forums or vendor articles. Not confirmed by the provider.", tone: "warning", rank: 3 },
  inferred: { label: "Inferred", chip: "Inferred", description: "Derived from other facts. No direct source.", tone: "neutral", rank: 4 },
  unknown: { label: "Unknown", chip: "Unknown", description: "Could not be determined from available sources.", tone: "neutral", rank: 5 },
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
