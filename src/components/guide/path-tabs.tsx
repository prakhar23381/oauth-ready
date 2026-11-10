"use client";

import { useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { ArrowUpRight, Bot, ChevronRight, Hourglass, TriangleAlert, User } from "lucide-react";
import { Chip } from "@/components/chip";
import { formatRange, type Owner, type Path, type Step } from "@/lib/schema/guide";
import { OWNER_META, TIER_META } from "@/lib/ui-meta";
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
const OWNER_WORD: Record<Owner, string> = { you: "You", agent: "Agent prepares", provider: "Provider" };

/** Three small numbers. The basis for each is on hover; the page never shows it inline. */
export function StatRow({ path }: { path: Path }) {
  const cells = [
    { label: "First test login", r: path.timeToFirstLogin, value: formatRange(path.timeToFirstLogin) },
    { label: "Your active work", r: path.activeEffort, value: formatRange(path.activeEffort) },
    { label: "Waiting on the provider", r: path.waitTime, value: path.waitTime.max === 0 ? "None" : formatRange(path.waitTime) },
  ];
  return (
    <dl className="grid grid-cols-3 divide-x border-y">
      {cells.map((c) => (
        <div key={c.label} className="px-3 py-3 first:pl-0 sm:px-4" title={`How we estimated this: ${c.r.basis}`}>
          <dt className="text-xs text-muted-foreground">{c.label}</dt>
          <dd className="mt-0.5 text-[17px] tabular-nums">{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StepRow({ step, index, open, onToggle }: { step: Step; index: number; open: boolean; onToggle: () => void }) {
  const Icon = OWNER_ICON[step.owner];
  const waiting = step.owner === "provider";
  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full cursor-pointer items-center gap-3 py-3 text-left hover:bg-accent/50">
        <span className="meta-mono w-5 shrink-0 text-subtle-foreground">{String(index + 1).padStart(2, "0")}</span>
        <Icon className={cn("size-4 shrink-0", waiting ? "text-warning" : step.owner === "agent" ? "text-foreground" : "text-subtle-foreground")} aria-label={OWNER_META[step.owner].label} />
        <span className="min-w-0 flex-1">{step.title}</span>
        {step.estTime && <span className={cn("meta-mono hidden shrink-0 sm:inline", waiting ? "text-warning" : "text-subtle-foreground")}>{formatRange(step.estTime)}</span>}
        <ChevronRight className={cn("size-4 shrink-0 text-subtle-foreground transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="space-y-3 pb-5 pl-8 sm:pl-[4.25rem]">
          <p className="meta-mono text-subtle-foreground">
            {OWNER_WORD[step.owner]}
            {step.estTime ? ` · ${formatRange(step.estTime)}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {step.detail}
            <ClaimRefs ids={step.claimIds} />
          </p>
          {step.copyValues.map((cv) => (
            <div key={cv.label} className="border border-code-border bg-code">
              <div className="flex items-center justify-between gap-2 border-b border-code-border px-3 py-1.5">
                <span className="text-xs text-muted-foreground">{cv.label}</span>
                <CopyButton value={cv.value} />
              </div>
              <code className="block px-3 py-2 font-mono text-[0.85rem] break-all text-code-foreground">{cv.value}</code>
            </div>
          ))}
          {step.gotchas.map((g) => (
            <p key={g} className="flex gap-2 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              {g}
            </p>
          ))}
          {step.links.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {step.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sm text-brand-ink hover:underline">
                  {l.label} <ArrowUpRight className="size-3.5" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function PathBody({ path }: { path: Path }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const allOpen = open.size === path.steps.length;
  const count = (o: Owner) => path.steps.filter((s) => s.owner === o).length;
  const who = (["you", "agent", "provider"] as Owner[]).filter((o) => count(o) > 0);
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {path.whenThisApplies}
        <ClaimRefs ids={path.claimIds} />
      </p>
      <StatRow path={path} />
      {path.cost && <p className="text-sm text-muted-foreground">Cost: {path.cost}</p>}

      <div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pb-2 text-sm text-muted-foreground">
          {who.map((o) => {
            const Icon = OWNER_ICON[o];
            return (
              <span key={o} className="inline-flex items-center gap-1.5">
                <Icon className={cn("size-4", o === "provider" ? "text-warning" : o === "agent" ? "text-foreground" : "text-subtle-foreground")} />
                {o === "you" ? `You do ${count(o)}` : o === "agent" ? `The agent prepares ${count(o)}` : `${count(o)} is a wait`}
              </span>
            );
          })}
          <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(path.steps.map((s) => s.id)))} className="ml-auto cursor-pointer text-brand-ink hover:underline">
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
        <ol className="divide-y border-y">
          {path.steps.map((s, i) => (
            <StepRow
              key={s.id}
              step={s}
              index={i}
              open={open.has(s.id)}
              onToggle={() =>
                setOpen((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id);
                  else next.add(s.id);
                  return next;
                })
              }
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

export function PathTabs({ paths }: { paths: Path[] }) {
  const def = paths.find((p) => p.isDefault) ?? paths[0];
  if (paths.length === 1) return <PathBody path={def} />;
  return (
    <Tabs.Root defaultValue={def.id}>
      <Tabs.List className={cn("grid gap-2", paths.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {paths.map((p) => (
          <Tabs.Tab
            key={p.id}
            value={p.id}
            className="flex cursor-pointer flex-col items-start gap-2 border bg-card p-3.5 text-left text-muted-foreground hover:text-foreground data-active:border-foreground data-active:text-foreground"
          >
            <span className="text-sm leading-snug">{p.name}</span>
            <span className="mt-auto text-xl leading-none tracking-[-0.01em] text-foreground tabular-nums">{formatRange(p.timeToProduction)}</span>
            <TierChip tier={p.tier} />
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {paths.map((p) => (
        <Tabs.Panel key={p.id} value={p.id} className="pt-6 outline-none">
          <PathBody path={p} />
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
