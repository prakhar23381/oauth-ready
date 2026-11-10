"use client";

import { Tabs } from "@base-ui/react/tabs";
import { ArrowUpRight, Bot, Hourglass, TriangleAlert, User } from "lucide-react";
import { Chip } from "@/components/chip";
import { formatRange, type Owner, type Path } from "@/lib/schema/guide";
import { OWNER_META, PHASE_LABEL, TIER_META, TONE_DOT } from "@/lib/ui-meta";
import { ClaimRefs } from "./claims";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";

export function TierChip({ tier }: { tier: 1 | 2 | 3 | 4 }) {
  const m = TIER_META[tier];
  return (
    <Chip tone={m.tone} title={m.blurb}>
      Tier {tier} · {m.label}
    </Chip>
  );
}

const OWNER_ICON: Record<Owner, typeof Bot> = { agent: Bot, you: User, provider: Hourglass };

export function OwnerChip({ owner }: { owner: Owner }) {
  const Icon = OWNER_ICON[owner];
  return (
    <Chip title={OWNER_META[owner].label} className={owner === "agent" ? "border-foreground/40 text-foreground" : undefined}>
      <Icon className="size-3" />
      {OWNER_META[owner].short}
    </Chip>
  );
}

export function StatGrid({ path, compact = false }: { path: Path; compact?: boolean }) {
  const cells = [
    { label: "First test login", value: formatRange(path.timeToFirstLogin), basis: path.timeToFirstLogin.basis },
    { label: "Your active work", value: formatRange(path.activeEffort), basis: path.activeEffort.basis },
    { label: "Waiting on provider", value: path.waitTime.max === 0 ? "None" : formatRange(path.waitTime), basis: path.waitTime.basis },
    { label: "Until real users", value: formatRange(path.timeToProduction), basis: path.timeToProduction.basis },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px border bg-border md:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className={cn("p-3.5", compact ? "bg-background" : "bg-card")}>
          <dt className="label-mono text-subtle-foreground">{c.label}</dt>
          <dd className="mt-1.5 text-xl leading-tight tracking-[-0.01em] tabular-nums">{c.value}</dd>
          {!compact && <dd className="mt-1.5 line-clamp-3 text-xs leading-snug text-muted-foreground" title={c.basis}>{c.basis}</dd>}
        </div>
      ))}
    </dl>
  );
}

function PathBody({ path }: { path: Path }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-muted-foreground">
          {path.whenThisApplies}
          <ClaimRefs ids={path.claimIds} />
        </p>
        <TierChip tier={path.tier} />
      </div>
      <StatGrid path={path} />
      {path.cost && (
        <p className="text-sm">
          <span className="label-mono mr-2 text-subtle-foreground">Cost</span>
          {path.cost}
        </p>
      )}

      <ol className="divide-y border-y">
        {path.steps.map((s, i) => (
          <li key={s.id} className="grid grid-cols-[2rem_1fr] gap-x-2 py-4">
            <span className="meta-mono pt-0.5 text-subtle-foreground">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <OwnerChip owner={s.owner} />
                <span className="label-mono text-subtle-foreground">{PHASE_LABEL[s.phase]}</span>
                {s.estTime && <span className="meta-mono ml-auto text-muted-foreground">~{formatRange(s.estTime)}</span>}
              </div>
              <h3 className="mt-2 text-[17px] leading-snug">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {s.detail}
                <ClaimRefs ids={s.claimIds} />
              </p>
              {s.copyValues.map((cv) => (
                <div key={cv.label} className="mt-3 border border-code-border bg-code">
                  <div className="flex items-center justify-between gap-2 border-b border-code-border px-3 py-1.5">
                    <span className="label-mono text-subtle-foreground">{cv.label}</span>
                    <CopyButton value={cv.value} />
                  </div>
                  <code className="block px-3 py-2 font-mono text-[0.85rem] break-all text-code-foreground">{cv.value}</code>
                </div>
              ))}
              {s.gotchas.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {s.gotchas.map((g) => (
                    <li key={g} className="flex gap-2 text-[13px] leading-snug">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
                      {g}
                    </li>
                  ))}
                </ul>
              )}
              {s.links.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {s.links.map((l) => (
                    <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[13px] text-brand-ink hover:underline">
                      {l.label} <ArrowUpRight className="size-3.5" />
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
    <Tabs.Root defaultValue={def.id}>
      <Tabs.List className="flex flex-col border-b sm:flex-row sm:flex-wrap sm:gap-x-6">
        {paths.map((p) => (
          <Tabs.Tab
            key={p.id}
            value={p.id}
            className={cn(
              "label-mono -mb-px flex cursor-pointer items-center gap-2 border-b-2 border-transparent py-2.5 text-left text-muted-foreground hover:text-foreground",
              "data-active:border-foreground data-active:text-foreground",
            )}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[TIER_META[p.tier].tone])} />
            <span>
              {p.name}
              {p.isDefault && <span className="text-subtle-foreground"> (most common)</span>}
            </span>
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {paths.map((p) => (
        <Tabs.Panel key={p.id} value={p.id} className="pt-5 outline-none">
          <PathBody path={p} />
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
