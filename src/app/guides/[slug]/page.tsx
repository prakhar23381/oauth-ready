import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, CircleCheck, Info, Minus, OctagonX, TriangleAlert } from "lucide-react";
import { getGuide, getOverlay } from "@/lib/guides";
import { defaultPath, type Guide } from "@/lib/schema/guide";
import { STATUS_META } from "@/lib/ui-meta";
import { ClaimDetail, ClaimRefs, ClaimsProvider, StatusChip } from "@/components/guide/claims";
import { PathTabs, StatGrid, TierChip } from "@/components/guide/path-tabs";
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
    <section id={id} className="scroll-mt-20">
      <h2 className="text-[22px] leading-tight tracking-[-0.01em]">{title}</h2>
      {lede && <p className="mt-1.5 text-sm text-muted-foreground">{lede}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const SEVERITY_ICON = {
  blocker: <OctagonX className="mt-1 size-4 shrink-0 text-destructive" />,
  warn: <TriangleAlert className="mt-1 size-4 shrink-0 text-warning" />,
  info: <Info className="mt-1 size-4 shrink-0 text-subtle-foreground" />,
};

function NuanceList({ items }: { items: Guide["nuances"] }) {
  return (
    <ul className="divide-y border-y">
      {items.map((n) => (
        <li key={n.title} className="flex gap-3 py-3.5">
          {SEVERITY_ICON[n.severity]}
          <div>
            <h3 className="text-[17px] leading-snug">{n.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {n.detail}
              <ClaimRefs ids={n.claimIds} />
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function evidenceStats(g: Guide) {
  const counts = new Map<string, number>();
  g.claims.forEach((c) => counts.set(c.status, (counts.get(c.status) ?? 0) + 1));
  return counts;
}

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
  const stats = evidenceStats(g);
  const handsOn = stats.get("hands_on") ?? 0;
  const agentNuances = g.nuances.filter((n) => n.forAgents);
  const otherNuances = g.nuances.filter((n) => !n.forAgents);

  return (
    <ClaimsProvider claims={g.claims}>
      <article className="mx-auto max-w-[720px] space-y-14 px-4 py-10 sm:px-6">
        <header className="space-y-5">
          <div className="flex items-start gap-4">
            {g.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.logoUrl} alt="" className="mt-1 size-10 border bg-white p-1.5" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-[32px] leading-[1.15] tracking-[-0.02em]">{g.appName}</h1>
              <p className="mt-1 text-muted-foreground">
                OAuth app setup and approval guide for{" "}
                <a href={g.website} target="_blank" rel="noreferrer" className="text-brand-ink hover:underline">
                  {g.website.replace(/^https?:\/\//, "")}
                </a>
              </p>
            </div>
          </div>
          <p className="meta-mono text-subtle-foreground">
            Researched {g.generatedAt} · {g.generator.kind === "live" ? "generated live by agent" : "library guide"} · {g.sources.length} sources ·{" "}
            {g.claims.length} claims{handsOn ? ` · ${handsOn} hands-on verified` : ""}
          </p>
          <ShareBar slug={g.slug} appName={g.appName} canRegenerate={g.generator.kind === "live"} />
        </header>

        {/* Verdict: the one elevated card on the page */}
        <section className="border bg-card p-5 shadow-elevated sm:p-6">
          <p className="text-2xl leading-[1.25] tracking-[-0.015em] sm:text-[26px]">
            {g.verdict.headline}
            <ClaimRefs ids={g.verdict.claimIds} />
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <TierChip tier={p.tier} />
            <span className="text-sm text-muted-foreground">on the most common path: {p.name.toLowerCase()}</span>
          </div>
          <div className="mt-5">
            <StatGrid path={p} compact />
          </div>
          {p.cost && (
            <p className="mt-4 text-sm">
              <span className="label-mono mr-2 text-subtle-foreground">Cost</span>
              {p.cost}
            </p>
          )}
          <p className="mt-4 flex gap-2.5 border-t pt-4 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              <span className="label-mono mr-2 text-warning">Biggest risk</span>
              {g.verdict.biggestRisk}
            </span>
          </p>
          <p className="mt-4 text-sm text-muted-foreground">{g.summary}</p>
        </section>

        <Section id="composio" title="Do you need your own OAuth app yet?">
          <div className="flex gap-3 border bg-card p-4">
            {g.composio.status === "managed" ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" /> : <Info className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />}
            <div className="space-y-1.5">
              <p>
                {g.composio.status === "managed" && "Composio has a managed app for this, so you can start building today."}
                {g.composio.status === "bring_your_own" && "Composio has no managed app for this one, so this guide is your critical path."}
                {g.composio.status === "not_listed" && "This app isn't in Composio's toolkit directory yet."}
              </p>
              <p className="text-sm text-muted-foreground">{g.composio.note}</p>
              {g.composio.setupGuideUrl && (
                <a href={g.composio.setupGuideUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[13px] text-brand-ink hover:underline">
                  Composio's click-by-click setup walkthrough <ArrowUpRight className="size-3.5" />
                </a>
              )}
            </div>
          </div>
        </Section>

        <Section
          id="plan"
          title="Your plan, by path"
          lede="How hard this is depends on what you request and who your users are. Pick the path that matches your product. Each step says who does it: the agent, you, or the provider."
        >
          <PathTabs paths={g.paths} />
        </Section>

        {g.requirements.length > 0 && (
          <Section id="requirements" title="What to have ready">
            <RequirementsChecklist slug={g.slug} requirements={g.requirements} paths={g.paths} />
          </Section>
        )}

        {agentNuances.length > 0 && (
          <Section id="agents" title="If you're building an AI agent" lede="Limits and policies that matter more for long-running agents than for ordinary apps.">
            <NuanceList items={agentNuances} />
          </Section>
        )}

        {otherNuances.length > 0 && (
          <Section id="nuances" title="Other things to know">
            <NuanceList items={otherNuances} />
          </Section>
        )}

        {g.blockers.length > 0 && (
          <Section id="stuck" title="If you get stuck">
            <div className="divide-y border-y">
              {g.blockers.map((b) => (
                <details key={b.symptom} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-start gap-2">
                    <span className="meta-mono mt-0.5 text-subtle-foreground transition group-open:rotate-90">›</span>
                    {b.symptom}
                  </summary>
                  <dl className="mt-2 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 pl-5 text-sm">
                    <dt className="label-mono pt-1 text-subtle-foreground">Cause</dt>
                    <dd className="text-muted-foreground">{b.cause}</dd>
                    <dt className="label-mono pt-1 text-subtle-foreground">Do this</dt>
                    <dd>
                      {b.fix}
                      <ClaimRefs ids={b.claimIds} />
                    </dd>
                    {b.escalation && (
                      <>
                        <dt className="label-mono pt-1 text-subtle-foreground">Escalate</dt>
                        <dd className="text-muted-foreground">{b.escalation}</dd>
                      </>
                    )}
                  </dl>
                </details>
              ))}
            </div>
          </Section>
        )}

        {g.handoffKit.length > 0 && (
          <Section id="handoff" title="What the agent prepared for you" lede="Review each item, then paste it into the provider's console or review form.">
            <div className="space-y-4">
              {g.handoffKit.map((h) => (
                <div key={h.title} className="border border-code-border bg-code">
                  <div className="flex items-center justify-between gap-2 border-b border-code-border px-4 py-2">
                    <span className="text-sm">{h.title}</span>
                    <CopyButton value={h.content} />
                  </div>
                  {h.description && <p className="px-4 pt-2 text-[13px] text-muted-foreground">{h.description}</p>}
                  <pre className="max-h-80 overflow-auto px-5 py-4 font-mono text-[0.85rem] leading-[1.6] whitespace-pre-wrap text-code-foreground">{h.content}</pre>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section id="evidence" title="Evidence and uncertainty" lede="Every claim in this guide is graded by where it came from. Open any chip in the text to see the quote and its source.">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[])
              .filter((s) => stats.get(s))
              .map((s) => (
                <span key={s} className="inline-flex items-center gap-2">
                  <StatusChip status={s} />
                  <span className="meta-mono text-muted-foreground">{stats.get(s)}</span>
                </span>
              ))}
          </div>

          {overlay && (
            <div className="mt-6">
              <h3 className="text-[17px]">What we tried by hand</h3>
              <ul className="mt-2 divide-y border-y">
                {overlay.attempts.map((a) => (
                  <li key={a.date + a.what} className="grid gap-1 py-3 text-sm sm:grid-cols-[6.5rem_1fr]">
                    <span className="meta-mono pt-0.5 text-subtle-foreground">{a.date}</span>
                    <span>
                      {a.what}. <span className="text-muted-foreground">{a.outcome}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <a href="/verification" className="mt-2 inline-block text-[13px] text-brand-ink hover:underline">See the full verification log</a>
            </div>
          )}

          {g.unknowns.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[17px]">What we couldn't verify</h3>
              <ul className="mt-2 divide-y border-y text-sm">
                {g.unknowns.map((u) => (
                  <li key={u} className="flex gap-2.5 py-2.5 text-muted-foreground">
                    <Minus className="mt-1 size-3.5 shrink-0 text-subtle-foreground" />
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {g.probes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[17px]">Live checks the agent ran</h3>
              <div className="mt-2 overflow-x-auto border">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b bg-card">
                      <th className="label-mono p-2.5 text-subtle-foreground">Check</th>
                      <th className="label-mono p-2.5 text-subtle-foreground">Result</th>
                      <th className="label-mono p-2.5 text-subtle-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {g.probes.map((pr) => (
                      <tr key={pr.check}>
                        <td className="p-2.5 align-top">
                          <span className="flex items-start gap-2">
                            {pr.ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> : <Minus className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" />}
                            <span>
                              {pr.check}
                              <span className="meta-mono block break-all text-subtle-foreground">{pr.target}</span>
                            </span>
                          </span>
                        </td>
                        <td className="p-2.5 align-top text-muted-foreground">{pr.result}</td>
                        <td className="meta-mono p-2.5 align-top whitespace-nowrap text-subtle-foreground">{pr.at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <details className="group mt-6 border-y py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2">
              <span className="meta-mono text-subtle-foreground transition group-open:rotate-90">›</span>
              All {g.claims.length} claims, strongest evidence first
            </summary>
            <ul className="mt-3 divide-y border-t">
              {[...g.claims]
                .sort((a, b) => STATUS_META[a.status].rank - STATUS_META[b.status].rank)
                .map((c) => (
                  <li key={c.id} className="py-3">
                    <ClaimDetail claim={c} />
                  </li>
                ))}
            </ul>
          </details>

          <div className="mt-6">
            <h3 className="text-[17px]">Sources</h3>
            <ul className="mt-2 divide-y border-y">
              {g.sources.map((s) => (
                <li key={s.url} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]">
                  <Chip tone={s.kind === "community" ? "warning" : "neutral"} className="w-[5.5rem] justify-center">{s.kind}</Chip>
                  <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 text-brand-ink hover:underline">{s.title}</a>
                  {s.fetchedAt && <span className="meta-mono text-subtle-foreground">{s.fetchedAt}</span>}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </article>
    </ClaimsProvider>
  );
}
