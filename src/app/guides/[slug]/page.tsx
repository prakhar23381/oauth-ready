import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, ChevronRight, CircleCheck, Info, Minus, OctagonX, TriangleAlert } from "lucide-react";
import { getGuide, getOverlay } from "@/lib/guides";
import { defaultPath, formatRange } from "@/lib/schema/guide";
import { STATUS_META } from "@/lib/ui-meta";
import { ClaimDetail, ClaimRefs, ClaimsProvider, StatusChip } from "@/components/guide/claims";
import { PathTabs, StatRow, TierChip } from "@/components/guide/path-tabs";
import { Toc } from "@/components/guide/toc";
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

function Section({ id, title, lede, children }: { id: string; title: string; lede?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t pt-10">
      <h2 className="text-[22px] leading-tight tracking-[-0.01em]">{title}</h2>
      {lede && <p className="mt-1.5 text-sm text-muted-foreground">{lede}</p>}
      <div className="mt-5">{children}</div>
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
    { id: "answer", label: "The short answer" },
    { id: "plan", label: "Your plan" },
    ...(g.requirements.length ? [{ id: "requirements", label: "What to have ready" }] : []),
    ...(nuances.length ? [{ id: "watch", label: "Watch out for" }] : []),
    ...(g.blockers.length ? [{ id: "stuck", label: "If you get stuck" }] : []),
    ...(g.handoffKit.length ? [{ id: "handoff", label: "Prepared for you" }] : []),
    { id: "evidence", label: "Evidence" },
  ];

  return (
    <ClaimsProvider claims={g.claims}>
      <div className="mx-auto grid max-w-[1000px] gap-x-12 px-4 py-10 sm:px-6 lg:grid-cols-[180px_minmax(0,720px)]">
        <Toc items={toc} />
        <article className="min-w-0 space-y-12">
          <header id="answer" className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3">
              {g.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.logoUrl} alt="" className="size-9 border bg-white p-1.5" />
              )}
              <div className="min-w-0">
                <h1 className="text-xl leading-tight">{g.appName}</h1>
                <p className="text-sm text-muted-foreground">OAuth app setup and approval</p>
              </div>
            </div>

            {/* The answer: one number, one sentence, three supporting numbers, one risk. */}
            <section className="border bg-card p-5 shadow-elevated sm:p-7">
              <p className="text-[44px] leading-[1.05] tracking-[-0.025em] tabular-nums sm:text-[56px]">{formatRange(p.timeToProduction)}</p>
              <p className="mt-1 text-muted-foreground">until real users can connect, on the most common path</p>
              <p className="mt-5 text-[17px] leading-snug">
                {g.verdict.headline}
                <ClaimRefs ids={g.verdict.claimIds} />
              </p>
              <div className="mt-5">
                <StatRow path={p} />
              </div>
              <p className="mt-4 flex gap-2.5 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>{g.verdict.biggestRisk}</span>
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <TierChip tier={p.tier} />
                {p.cost && <span className="text-sm text-muted-foreground">Has a cost. See the plan.</span>}
              </div>
            </section>

            <div className={`flex gap-3 border-l-2 pl-3.5 ${g.composio.status === "managed" ? "border-success" : "border-border"}`}>
              <div className="min-w-0 space-y-1 text-sm">
                <p className="flex items-center gap-2 text-[15px]">
                  {g.composio.status === "managed" && <CircleCheck className="size-4 shrink-0 text-success" />}
                  {g.composio.status === "managed" && "You can start today on Composio's managed app."}
                  {g.composio.status === "bring_your_own" && "Composio has no managed app here, so you need your own."}
                  {g.composio.status === "not_listed" && "This app isn't in Composio's toolkit directory yet."}
                </p>
                <p className="text-muted-foreground">{g.composio.note}</p>
                {g.composio.setupGuideUrl && (
                  <a href={g.composio.setupGuideUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-ink hover:underline">
                    Composio's setup walkthrough <ArrowUpRight className="size-3.5" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <ShareBar slug={g.slug} appName={g.appName} canRegenerate={g.generator.kind === "live"} />
              <p className="meta-mono text-subtle-foreground">
                {g.generatedAt} · {g.sources.length} sources{handsOn ? ` · ${handsOn} tested by hand` : ""}
              </p>
            </div>
          </header>

          <Section id="plan" title="Your plan" lede={g.paths.length > 1 ? "How hard this is depends on what you ask for. Pick the path that matches your product, then open a step for the details." : "Open a step for the details."}>
            <PathTabs paths={g.paths} />
          </Section>

          {g.requirements.length > 0 && (
            <Section id="requirements" title="What to have ready">
              <RequirementsChecklist slug={g.slug} requirements={g.requirements} paths={g.paths} />
            </Section>
          )}

          {nuances.length > 0 && (
            <Section id="watch" title="Watch out for">
              <div className="divide-y border-y">
                {nuances.map((n) => (
                  <Disclosure key={n.title} icon={SEVERITY_ICON[n.severity]} title={n.title} aside={n.forAgents ? <Chip>AI agents</Chip> : undefined}>
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
            <Section id="stuck" title="If you get stuck">
              <div className="divide-y border-y">
                {g.blockers.map((b) => (
                  <Disclosure key={b.symptom} title={b.symptom}>
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">{b.cause}</p>
                      <p>
                        {b.fix}
                        <ClaimRefs ids={b.claimIds} />
                      </p>
                      {b.escalation && <p className="text-muted-foreground">Escalate through: {b.escalation}</p>}
                    </div>
                  </Disclosure>
                ))}
              </div>
            </Section>
          )}

          {g.handoffKit.length > 0 && (
            <Section id="handoff" title="Prepared for you" lede="Drafts the agent wrote so you don't start from a blank form. Review before you paste.">
              <div className="divide-y border-y">
                {g.handoffKit.map((h) => (
                  <Disclosure key={h.title} title={h.title}>
                    <div className="border border-code-border bg-code">
                      <div className="flex justify-end border-b border-code-border px-3 py-1.5">
                        <CopyButton value={h.content} />
                      </div>
                      <pre className="max-h-80 overflow-auto px-4 py-3 font-mono text-[0.85rem] leading-[1.6] whitespace-pre-wrap text-code-foreground">{h.content}</pre>
                    </div>
                  </Disclosure>
                ))}
              </div>
            </Section>
          )}

          <Section id="evidence" title="Evidence" lede="Each marker in the guide opens the quote and source behind that sentence.">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[])
                .filter((s) => counts.get(s))
                .map((s) => (
                  <span key={s} className="inline-flex items-center gap-2">
                    <StatusChip status={s} />
                    <span className="meta-mono text-muted-foreground">{counts.get(s)}</span>
                  </span>
                ))}
            </div>

            {g.unknowns.length > 0 && (
              <div className="mt-6">
                <h3 className="text-[17px]">What we couldn't verify</h3>
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
                <Disclosure title="What we tried by hand" aside={<span className="meta-mono text-subtle-foreground">{overlay.attempts.length}</span>}>
                  <ul className="space-y-2 text-sm">
                    {overlay.attempts.map((a) => (
                      <li key={a.date + a.what}>
                        <span className="meta-mono mr-2 text-subtle-foreground">{a.date}</span>
                        {a.what}. <span className="text-muted-foreground">{a.outcome}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="/verification" className="mt-2 inline-block text-sm text-brand-ink hover:underline">See the full verification log</a>
                </Disclosure>
              )}
              {g.probes.length > 0 && (
                <Disclosure title="Live checks the agent ran" aside={<span className="meta-mono text-subtle-foreground">{g.probes.length}</span>}>
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
              <Disclosure title="Every claim, strongest evidence first" aside={<span className="meta-mono text-subtle-foreground">{g.claims.length}</span>}>
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
