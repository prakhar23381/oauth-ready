"use client";

import { createContext, useContext } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Claim } from "@/lib/schema/guide";
import { STATUS_META } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

const ClaimsCtx = createContext<Map<string, Claim>>(new Map());

export function ClaimsProvider({ claims, children }: { claims: Claim[]; children: React.ReactNode }) {
  return <ClaimsCtx.Provider value={new Map(claims.map((c) => [c.id, c]))}>{children}</ClaimsCtx.Provider>;
}

export function StatusPill({ status, className }: { status: Claim["status"]; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", m.className, className)} title={m.description}>
      {m.label}
    </span>
  );
}

export function ClaimDetail({ claim }: { claim: Claim }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill status={claim.status} />
        <span className="text-xs text-muted-foreground">confidence: {claim.confidence}</span>
        {claim.asOf && <span className="text-xs text-muted-foreground">· as of {claim.asOf}</span>}
        {claim.verifiedQuote === false && <span className="text-xs font-medium text-rose-600">· quote not found in source</span>}
      </div>
      <p className="leading-snug">{claim.text}</p>
      {claim.conflict && (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Sources disagree:</strong> {claim.conflict}
        </p>
      )}
      {claim.sources.map((s, i) => (
        <div key={i} className="border-l-2 border-border pl-2 text-xs">
          {s.quote && <p className="mb-1 italic text-foreground/80">“{s.quote}”</p>}
          <a href={s.url} target="_blank" rel="noreferrer" className="break-all text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">
            {s.title ?? s.url}
          </a>
        </div>
      ))}
    </div>
  );
}

/** Small evidence chips after a sentence; each opens the claim with its quote + source. */
export function ClaimRefs({ ids, className }: { ids?: string[]; className?: string }) {
  const claims = useContext(ClaimsCtx);
  const list = (ids ?? []).map((id) => claims.get(id)).filter((c): c is Claim => !!c);
  if (!list.length) return null;
  return (
    <span className={cn("ml-1 inline-flex flex-wrap gap-0.5 align-middle", className)}>
      {list.map((c) => (
        <Popover key={c.id}>
          <PopoverTrigger
            className={cn(
              "inline-flex h-4 min-w-4 cursor-pointer items-center justify-center rounded px-1 text-[10px] font-bold leading-none ring-1 ring-inset transition hover:opacity-80",
              c.status === "official_doc" && "bg-sky-50 text-sky-700 ring-sky-600/30 dark:bg-sky-950 dark:text-sky-300",
              c.status === "hands_on" && "bg-emerald-50 text-emerald-700 ring-emerald-600/30 dark:bg-emerald-950 dark:text-emerald-300",
              c.status === "probe" && "bg-indigo-50 text-indigo-700 ring-indigo-600/30",
              c.status === "community" && "bg-amber-50 text-amber-800 ring-amber-600/30 dark:bg-amber-950 dark:text-amber-300",
              (c.status === "inferred" || c.status === "unknown") && "bg-slate-50 text-slate-600 ring-slate-500/30",
              c.conflict && "ring-2 ring-amber-500",
            )}
            aria-label={`Evidence: ${STATUS_META[c.status].label}`}
          >
            {c.status === "official_doc" ? "doc" : c.status === "hands_on" ? "✓" : c.status === "community" ? "com" : c.status === "probe" ? "probe" : "?"}
            {c.conflict ? "!" : ""}
          </PopoverTrigger>
          <PopoverContent className="w-96 max-w-[calc(100vw-2rem)]">
            <ClaimDetail claim={c} />
          </PopoverContent>
        </Popover>
      ))}
    </span>
  );
}
