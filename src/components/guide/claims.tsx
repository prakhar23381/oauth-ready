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

/** Evidence chips after a sentence. Each opens the claim with its quote and source. */
export function ClaimRefs({ ids, className }: { ids?: string[]; className?: string }) {
  const claims = useContext(ClaimsCtx);
  const list = (ids ?? []).map((id) => claims.get(id)).filter((c): c is Claim => !!c);
  if (!list.length) return null;
  return (
    <span className={cn("ml-1.5 inline-flex flex-wrap gap-1 align-[1px]", className)}>
      {list.map((c) => (
        <Popover key={c.id}>
          <PopoverTrigger
            aria-label={`Evidence: ${STATUS_META[c.status].label}`}
            className={cn(
              "label-mono inline-flex h-4 cursor-pointer items-center gap-0.5 border px-1 text-[9.5px] hover:bg-accent data-popup-open:bg-accent",
              TONE_CLASS[claimTone(c)],
            )}
          >
            {STATUS_META[c.status].chip}
            {(c.conflict || c.verifiedQuote === false) && <TriangleAlert className="size-2.5" />}
          </PopoverTrigger>
          <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] p-3 shadow-elevated ring-border">
            <ClaimDetail claim={c} />
          </PopoverContent>
        </Popover>
      ))}
    </span>
  );
}
