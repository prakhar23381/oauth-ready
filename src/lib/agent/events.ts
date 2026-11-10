export type Stage = "identify" | "search" | "read" | "followup" | "write" | "verify";

export type AgentEvent =
  | { type: "stage"; stage: Stage; status: "start" | "done"; note?: string }
  | { type: "search"; query: string }
  | { type: "source"; url: string; title: string; official: boolean }
  | { type: "fact"; topic: string; claim: string; url: string }
  | { type: "probe"; check: string; ok: boolean; result: string }
  | { type: "wait"; ms: number; reason: string }
  | { type: "note"; message: string }
  | { type: "done"; slug: string; cached: boolean; ms: number }
  | { type: "error"; message: string };

export type Emit = (e: AgentEvent) => void;
