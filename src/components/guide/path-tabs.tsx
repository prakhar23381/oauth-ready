"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRange, type Path } from "@/lib/schema/guide";
import { OWNER_META, PHASE_LABEL, TIER_META } from "@/lib/ui-meta";
import { ClaimRefs } from "./claims";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

export function TierBadge({ tier, className }: { tier: 1 | 2 | 3 | 4; className?: string }) {
  const m = TIER_META[tier];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", m.className, className)} title={m.blurb}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      Tier {tier} · {m.label}
    </span>
  );
}

export function OwnerChip({ owner }: { owner: keyof typeof OWNER_META }) {
  const m = OWNER_META[owner];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", m.className)} title={m.label}>
      <span aria-hidden>{m.emoji}</span>
      {m.short}
    </span>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" title={sub}>{sub}</div>}
    </div>
  );
}

function PathBody({ path }: { path: Path }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <TierBadge tier={path.tier} />
        <span className="text-sm text-muted-foreground">{path.whenThisApplies}</span>
        <ClaimRefs ids={path.claimIds} />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="First test login" value={formatRange(path.timeToFirstLogin)} sub={path.timeToFirstLogin.basis} />
        <Metric label="Your active work" value={formatRange(path.activeEffort)} sub={path.activeEffort.basis} />
        <Metric label="Waiting on provider" value={path.waitTime.max === 0 ? "None" : formatRange(path.waitTime)} sub={path.waitTime.basis} />
        <Metric label="Until real users" value={formatRange(path.timeToProduction)} sub={path.cost ? `Cost: ${path.cost}` : path.timeToProduction.basis} />
      </div>

      <ol className="relative space-y-3 border-l border-border pl-5">
        {path.steps.map((s, i) => (
          <li key={s.id} className="relative">
            <span className="absolute -left-[29px] top-1 flex size-4 items-center justify-center rounded-full border bg-background text-[10px] font-bold text-muted-foreground">
              {i + 1}
            </span>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <OwnerChip owner={s.owner} />
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{PHASE_LABEL[s.phase]}</span>
                  <h4 className="font-semibold">{s.title}</h4>
                </div>
                {s.estTime && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">~{formatRange(s.estTime)}</span>}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
                {s.detail}
                <ClaimRefs ids={s.claimIds} />
              </p>
              {s.copyValues.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {s.copyValues.map((cv) => (
                    <div key={cv.label} className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-2 py-1.5">
                      <span className="text-xs text-muted-foreground">{cv.label}</span>
                      <code className="min-w-0 flex-1 break-all font-mono text-xs">{cv.value}</code>
                      <CopyButton value={cv.value} />
                    </div>
                  ))}
                </div>
              )}
              {s.gotchas.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {s.gotchas.map((g) => (
                    <li key={g} className="text-xs text-amber-800 dark:text-amber-300">⚠ {g}</li>
                  ))}
                </ul>
              )}
              {s.links.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3">
                  {s.links.map((l) => (
                    <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline dark:text-sky-400">
                      {l.label} <ExternalLink className="size-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PathTabs({ paths }: { paths: Path[] }) {
  const def = paths.find((p) => p.isDefault) ?? paths[0];
  if (paths.length === 1) return <PathBody path={def} />;
  return (
    <Tabs defaultValue={def.id}>
      <TabsList className="h-auto! w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
        {paths.map((p) => (
          <TabsTrigger key={p.id} value={p.id} className="h-auto! flex-none whitespace-normal px-3 py-1.5 text-left">
            <span className={cn("mr-1.5 inline-block size-2 rounded-full", TIER_META[p.tier].dot)} />
            {p.name}
            {p.isDefault && <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">most common</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      {paths.map((p) => (
        <TabsContent key={p.id} value={p.id} className="pt-3">
          <PathBody path={p} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
