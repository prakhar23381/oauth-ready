import type { ClaimStatus, Owner } from "@/lib/schema/guide";

export const TIER_META: Record<1 | 2 | 3 | 4, { label: string; blurb: string; className: string; dot: string }> = {
  1: { label: "Self-serve", blurb: "No provider review on this path", className: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-emerald-500" },
  2: { label: "Light review", blurb: "A provider check or listing, usually days", className: "bg-sky-50 text-sky-800 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300", dot: "bg-sky-500" },
  3: { label: "Formal review", blurb: "Required review or security assessment, usually weeks", className: "bg-amber-50 text-amber-900 ring-amber-600/25 dark:bg-amber-950 dark:text-amber-300", dot: "bg-amber-500" },
  4: { label: "Gated", blurb: "Business status, partnership, MAU or paid tier required", className: "bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-300", dot: "bg-rose-500" },
};

export const OWNER_META: Record<Owner, { label: string; short: string; emoji: string; className: string }> = {
  agent: { label: "Agent can do / prepare", short: "Agent", emoji: "🤖", className: "bg-violet-50 text-violet-800 ring-violet-600/20 dark:bg-violet-950 dark:text-violet-300" },
  you: { label: "You must do", short: "You", emoji: "👤", className: "bg-slate-100 text-slate-800 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-200" },
  provider: { label: "Waiting on provider", short: "Wait", emoji: "⏳", className: "bg-amber-50 text-amber-900 ring-amber-600/25 dark:bg-amber-950 dark:text-amber-300" },
};

export const STATUS_META: Record<ClaimStatus, { label: string; description: string; className: string; rank: number }> = {
  hands_on: { label: "Hands-on verified", description: "We tried this ourselves", className: "bg-emerald-600 text-white", rank: 0 },
  official_doc: { label: "Official docs", description: "Provider documentation, with quote", className: "bg-sky-600 text-white", rank: 1 },
  probe: { label: "Live probe", description: "Automated HTTP check by the agent", className: "bg-indigo-600 text-white", rank: 2 },
  community: { label: "Community report", description: "Forums, vendor blogs, anecdotes", className: "bg-amber-500 text-white", rank: 3 },
  inferred: { label: "Inferred", description: "Reasoned from other facts; no direct source", className: "bg-slate-500 text-white", rank: 4 },
  unknown: { label: "Unknown", description: "Looked, couldn't find out", className: "bg-slate-300 text-slate-800", rank: 5 },
};

export const PHASE_LABEL: Record<string, string> = {
  account: "Account", create: "Create app", configure: "Configure", test: "Test", review: "Review", wait: "Wait", launch: "Launch",
};
