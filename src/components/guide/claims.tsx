"use client";

import { createContext, useContext } from "react";
import { TriangleAlert } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Chip } from "@/components/chip";
import type { Claim } from "@/lib/schema/guide";
import { STATUS_META, TONE_CLASS, type Tone } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

const ClaimsCtx = createContext<Map<string, Claim>>(new Map());

export function ClaimsProvider({ claims, children }: { claims: Claim[]; children: React.ReactNode }) {
  return <ClaimsCtx.Provider value={new Map(claims.map((c) => [c.id, c]))}>{children}</ClaimsCtx.Provider>;
}

/** Tone for a claim: a failed quote check or a source conflict outranks the status tone. */
function claimTone(c: Claim): Tone {
  if (c.verifiedQuote === false) return "destructive";
  if (c.conflict) return "warning";
  return STATUS_META[c.status].tone;
}

export function StatusChip({ status }: { status: Claim["status"] }) {
  const m = STATUS_META[status];
  return <Chip tone={m.tone} title={m.description}>{m.label}</Chip>;
}

export function ClaimDetail({ claim }: { claim: Claim }) {
  return (
    <div className="space-y-2 text-[13px] leading-normal">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusChip status={claim.status} />
        <span className="meta-mono text-subtle-foreground">
          confidence {claim.confidence}
          {claim.asOf ? ` · as of ${claim.asOf}` : ""}
        </span>
      </div>
      <p className="text-sm">{claim.text}</p>
      {claim.verifiedQuote === false && (
        <p className="flex gap-1.5 text-destructive">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> The quote wasn't found in the fetched page, so treat this as unverified.
        </p>
      )}
      {claim.conflict && (
        <p className="flex gap-1.5 border-l-2 border-warning pl-2 text-muted-foreground">
          <span>
            <span className="text-warning">Sources disagree.</span> {claim.conflict}
          </span>
        </p>
      )}
      {claim.sources.map((s, i) => (
        <div key={i} className="border-l-2 border-border pl-2">
          {s.quote && <p className="mb-1 text-muted-foreground">“{s.quote}”</p>}
          <a href={s.url} target="_blank" rel="noreferrer" className="meta-mono break-all text-brand-ink hover:underline">
            {s.title ?? s.url.replace(/^https?:\/\//, "")}
          </a>
        </div>
      ))}
    </div>
  );
}

const TONE_RANK: Record<Tone, number> = { neutral: 0, success: 0, warning: 1, destructive: 2 };

/**
 * One quiet evidence marker per sentence, however many claims back it.
 * It takes the tone of the weakest claim; the popover lists every claim with its quote and source.
 */
export function ClaimRefs({ ids, className }: { ids?: string[]; className?: string }) {
  const claims = useContext(ClaimsCtx);
  const list = (ids ?? []).map((id) => claims.get(id)).filter((c): c is Claim => !!c);
  if (!list.length) return null;
  const tone = list.map(claimTone).sort((a, b) => TONE_RANK[b] - TONE_RANK[a])[0];
  const statuses = new Set(list.map((c) => c.status));
  const label = statuses.size === 1 ? STATUS_META[list[0].status].chip : "Mixed";
  const flagged = list.some((c) => c.conflict || c.verifiedQuote === false);
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Evidence: ${list.length} ${list.length === 1 ? "claim" : "claims"}`}
        className={cn(
          "label-mono ml-1.5 inline-flex h-4 cursor-pointer items-center gap-1 border px-1 align-[1px] text-[9.5px] hover:bg-accent data-popup-open:bg-accent",
          TONE_CLASS[tone],
          className,
        )}
      >
        {label}
        {list.length > 1 && <span className="opacity-70">{list.length}</span>}
        {flagged && <TriangleAlert className="size-2.5" />}
      </PopoverTrigger>
      <PopoverContent className="max-h-[min(28rem,70vh)] w-96 max-w-[calc(100vw-2rem)] gap-0 divide-y overflow-y-auto p-0 shadow-elevated ring-border">
        {list.map((c) => (
          <div key={c.id} className="p-3">
            <ClaimDetail claim={c} />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
