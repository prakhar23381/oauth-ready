import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, ChevronRight, CircleCheck, Info, Minus, OctagonX, TriangleAlert } from "lucide-react";
import { getGuide, getOverlay } from "@/lib/guides";
import { defaultPath, formatRange } from "@/lib/schema/guide";
import { STATUS_META } from "@/lib/ui-meta";
import { ClaimDetail, ClaimRefs, ClaimsProvider, StatusChip } from "@/components/guide/claims";
import { PathTabs, StatRow, TierChip } from "@/components/guide/path-tabs";
import { Toc } from "@/components/guide/toc";
import { Tip } from "@/components/tip";
import { Chip } from "@/components/chip";
import { RequirementsChecklist } from "@/components/guide/requirements";
import { ShareBar } from "@/components/guide/share-bar";
import { CopyButton } from "@/components/guide/copy-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = await getGuide(slug);
  if (!g) return { title: "Guide not found · OAuth Ready" };
  return { title: `${g.appName}: OAuth app guide · OAuth Ready`, description: g.verdict.headline };
}

function Section({ id, title, tip, children }: { id: string; title: string; tip?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t pt-10">
      <h2 className="text-[22px] leading-tight tracking-[-0.01em]">
        {title}
        {tip && <Tip content={tip} label={`About: ${title}`} className="ml-2 align-[-1px]" />}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A row that shows only its title until opened. Keeps secondary detail off the page by default. */
function Disclosure({ icon, title, aside, children }: { icon?: React.ReactNode; title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 hover:bg-accent/50">
        {icon}
        <span className="min-w-0 flex-1">{title}</span>
        {aside}
        <ChevronRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

const SEVERITY_ICON = {
  blocker: <OctagonX className="size-4 shrink-0 text-destructive" />,
  warn: <TriangleAlert className="size-4 shrink-0 text-warning" />,
  info: <Info className="size-4 shrink-0 text-subtle-foreground" />,
};
const SEVERITY_RANK = { blocker: 0, warn: 1, info: 2 };

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await getGuide(slug);
  if (!g) notFound();
  const overlay = await getOverlay(slug);

  // Merge hands-on verification: confirmed claims are upgraded to hands_on.
  if (overlay) {
    for (const chk of overlay.claimChecks) {
      const c = chk.claimId && g.claims.find((x) => x.id === chk.claimId);
      if (!c) continue;
      if (chk.result === "confirmed" && chk.method === "hands_on") c.status = "hands_on";
      if (chk.result === "corrected") c.conflict = `Corrected after ${chk.method === "hands_on" ? "hands-on test" : "source check"}: ${chk.finding}`;
    }
  }

  const p = defaultPath(g);
  const counts = new Map<string, number>();
  g.claims.forEach((c) => counts.set(c.status, (counts.get(c.status) ?? 0) + 1));
  const handsOn = counts.get("hands_on") ?? 0;
  const nuances = [...g.nuances].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || Number(b.forAgents) - Number(a.forAgents));

  const toc = [
    { id: "answer", label: "Summary" },
    { id: "plan", label: "Setup plan" },
    ...(g.requirements.length ? [{ id: "requirements", label: "Prerequisites" }] : []),
    ...(nuances.length ? [{ id: "watch", label: "Considerations" }] : []),
    ...(g.blockers.length ? [{ id: "stuck", label: "Troubleshooting" }] : []),
    ...(g.handoffKit.length ? [{ id: "handoff", label: "Prepared materials" }] : []),
    { id: "evidence", label: "Evidence" },
  ];

  return (
    <ClaimsProvider claims={g.claims}>
      <div className="mx-auto grid max-w-[1240px] gap-x-12 px-4 py-10 sm:px-6 lg:grid-cols-[168px_minmax(0,1fr)]">
        <Toc items={toc} />
        <article className="min-w-0 space-y-12">
          <header id="answer" className="scroll-mt-24 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <div className="flex items-center gap-3">
                {g.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.logoUrl} alt="" className="size-9 border bg-white p-1.5" />
                )}
                <div className="min-w-0">
                  <h1 className="text-xl leading-tight">{g.appName}</h1>
                  <p className="text-sm text-muted-foreground">OAuth app setup and approval guide</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Tip
                  content={`Researched ${g.generatedAt} from ${g.sources.length} sources and ${g.claims.length} graded claims. ${g.generator.kind === "live" ? "Generated live by the agent" : "Library guide"}: ${g.generator.by}.`}
                >
                  <span className="meta-mono text-subtle-foreground">
                    {g.generatedAt} · {g.sources.length} sources{handsOn ? ` · ${handsOn} verified hands-on` : ""}
                  </span>
                </Tip>
                <ShareBar slug={g.slug} appName={g.appName} canRegenerate={g.generator.kind === "live"} />
              </div>
            </div>

            {/* The answer: one number, one sentence, three supporting numbers. Everything else is a tip. */}
            <section className="border bg-card p-5 shadow-elevated sm:p-7">
              <div className="grid items-end gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <div>
              <p className="text-[44px] leading-[1.05] tracking-[-0.025em] tabular-nums sm:text-[56px]">{formatRange(p.timeToProduction)}</p>
              <p className="mt-1 text-muted-foreground">
                Estimated time to production
                <Tip label="About this estimate" content={<>Time until any end user can connect, for the most common path: {p.name.toLowerCase()}. <span className="text-muted-foreground">{p.timeToProduction.basis}</span></>} />
              </p>
              <p className="mt-5 text-[17px] leading-snug">
                {g.verdict.headline}
                <ClaimRefs ids={g.verdict.claimIds} />
              </p>
                </div>
                <StatRow path={p} vertical />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <TierChip tier={p.tier} />
                {!g.oauthSupported && (
                  <Tip content={g.oauthNotes ?? "This provider does not offer OAuth for third-party apps."}>
                    <Chip>No OAuth app required</Chip>
                  </Tip>
                )}
                <Tip content={g.verdict.biggestRisk}>
                  <Chip tone="warning">
                    <TriangleAlert className="size-3" /> Key risk
                  </Chip>
                </Tip>
                {p.cost && !/^none/i.test(p.cost) && (
                  <Tip content={p.cost}>
                    <Chip>Fees apply</Chip>
                  </Tip>
                )}
                {g.composio.status === "managed" && (
                  <Tip
                    content={
                      <>
                        <p>{g.composio.note}</p>
                        {g.composio.setupGuideUrl && (
                          <a href={g.composio.setupGuideUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-0.5 text-brand-ink hover:underline">
                            Composio setup guide <ArrowUpRight className="size-3.5" />
                          </a>
                        )}
                      </>
                    }
                  >
                    <Chip tone="success">
                      <CircleCheck className="size-3" /> Composio-managed app available
                    </Chip>
                  </Tip>
                )}
                {g.composio.status !== "managed" && (
                  <Tip content={g.composio.note}>
                    <Chip>{g.composio.status === "bring_your_own" ? "Own OAuth app required" : "Not in Composio directory"}</Chip>
                  </Tip>
                )}
              </div>
            </section>

          </header>

          <Section id="plan" title="Setup plan" tip={g.paths.length > 1 ? "Effort depends on the scopes requested and the intended audience. Select the path that matches your product, then expand a step for details." : "Expand a step for details."}>
            <PathTabs paths={g.paths} />
          </Section>

          <div className="grid gap-x-12 gap-y-12 lg:grid-cols-2">
          {g.requirements.length > 0 && (
            <Section id="requirements" title="Prerequisites" tip="Progress is saved in this browser only.">
              <RequirementsChecklist slug={g.slug} requirements={g.requirements} paths={g.paths} />
            </Section>
          )}

          {nuances.length > 0 && (
            <Section id="watch" title="Considerations" tip="Limits and policies that affect setup or ongoing operation, most severe first.">
              <div className="divide-y border-y">
                {nuances.map((n) => (
                  <Disclosure key={n.title} icon={SEVERITY_ICON[n.severity]} title={n.title} aside={n.forAgents ? <Tip content="Particularly relevant to long-running AI agents."><Chip>AI agents</Chip></Tip> : undefined}>
                    <p className="pl-7 text-sm text-muted-foreground">
                      {n.detail}
                      <ClaimRefs ids={n.claimIds} />
                    </p>
                  </Disclosure>
                ))}
              </div>
            </Section>
          )}

          {g.blockers.length > 0 && (
            <Section id="stuck" title="Troubleshooting">
              <div className="divide-y border-y">
                {g.blockers.map((b) => (
                  <Disclosure key={b.symptom} title={b.symptom}>
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">{b.cause}</p>
                      <p>
                        {b.fix}
                        <ClaimRefs ids={b.claimIds} />
                      </p>
                      {b.escalation && <p className="text-muted-foreground">Escalation: {b.escalation}</p>}
                    </div>
                  </Disclosure>
                ))}
              </div>
            </Section>
          )}

          {g.handoffKit.length > 0 && (
            <Section id="handoff" title="Prepared materials" tip="Drafts prepared by the agent for the provider's console and review forms. Review before submitting.">
              <div className="divide-y border-y">
                {g.handoffKit.map((h) => (
                  <Disclosure key={h.title} title={h.title}>
                    <div className="relative border border-code-border bg-code">
                      <CopyButton value={h.content} className="absolute top-1.5 right-1.5 bg-code" />
                      <pre className="max-h-80 overflow-auto py-3 pr-10 pl-4 font-mono text-[0.85rem] leading-[1.6] whitespace-pre-wrap text-code-foreground">{h.content}</pre>
                    </div>
                  </Disclosure>
                ))}
              </div>
            </Section>
          )}

          </div>

          <Section id="evidence" title="Evidence" tip="Each claim is graded by its source. Markers throughout the guide open the supporting quote and reference.">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[])
                .filter((s) => counts.get(s))
                .map((s) => (
                  <Tip key={s} content={STATUS_META[s].description} className="items-center gap-2">
                    <StatusChip status={s} />
                    <span className="meta-mono text-muted-foreground">{counts.get(s)}</span>
                  </Tip>
                ))}
            </div>

            {g.unknowns.length > 0 && (
              <div className="mt-6">
                <h3 className="text-[17px]">Unverified items</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {g.unknowns.map((u) => (
                    <li key={u} className="flex gap-2.5">
                      <Minus className="mt-1 size-3.5 shrink-0 text-subtle-foreground" />
                      {u}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 divide-y border-y">
              {overlay && (
                <Disclosure title="Hands-on verification" aside={<span className="meta-mono text-subtle-foreground">{overlay.attempts.length}</span>}>
                  <ul className="space-y-2 text-sm">
                    {overlay.attempts.map((a) => (
                      <li key={a.date + a.what}>
                        <span className="meta-mono mr-2 text-subtle-foreground">{a.date}</span>
                        {a.what}. <span className="text-muted-foreground">{a.outcome}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="/verification" className="mt-2 inline-block text-sm text-brand-ink hover:underline">View the full verification log</a>
                </Disclosure>
              )}
              {g.probes.length > 0 && (
                <Disclosure title="Automated endpoint checks" aside={<span className="meta-mono text-subtle-foreground">{g.probes.length}</span>}>
                  <ul className="space-y-3 text-sm">
                    {g.probes.map((pr) => (
                      <li key={pr.check} className="flex gap-2.5">
                        {pr.ok ? <Check className="mt-1 size-3.5 shrink-0 text-success" /> : <Minus className="mt-1 size-3.5 shrink-0 text-subtle-foreground" />}
                        <span className="min-w-0">
                          {pr.check}
                          <span className="block text-muted-foreground">{pr.result}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              )}
              <Disclosure title="All claims" aside={<span className="meta-mono text-subtle-foreground">{g.claims.length}</span>}>
                <ul className="divide-y">
                  {[...g.claims]
                    .sort((a, b) => STATUS_META[a.status].rank - STATUS_META[b.status].rank)
                    .map((c) => (
                      <li key={c.id} className="py-3 first:pt-0">
                        <ClaimDetail claim={c} />
                      </li>
                    ))}
                </ul>
              </Disclosure>
              <Disclosure title="Sources" aside={<span className="meta-mono text-subtle-foreground">{g.sources.length}</span>}>
                <ul className="space-y-1.5 text-sm">
                  {g.sources.map((s) => (
                    <li key={s.url} className="flex items-baseline gap-3">
                      <span className={`meta-mono w-20 shrink-0 ${s.kind === "community" ? "text-warning" : "text-subtle-foreground"}`}>{s.kind}</span>
                      <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 text-brand-ink hover:underline">{s.title}</a>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </div>
          </Section>
        </article>
      </div>
    </ClaimsProvider>
  );
}
