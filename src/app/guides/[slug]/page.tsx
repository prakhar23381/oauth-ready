import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, Bot, ExternalLink, FlaskConical, HelpCircle, ShieldCheck } from "lucide-react";
import { getGuide, getOverlay } from "@/lib/guides";
import { defaultPath, formatRange, type Guide } from "@/lib/schema/guide";
import { STATUS_META } from "@/lib/ui-meta";
import { ClaimDetail, ClaimRefs, ClaimsProvider, StatusPill } from "@/components/guide/claims";
import { PathTabs, TierBadge } from "@/components/guide/path-tabs";
import { RequirementsChecklist } from "@/components/guide/requirements";
import { ShareBar } from "@/components/guide/share-bar";
import { CopyButton } from "@/components/guide/copy-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = await getGuide(slug);
  if (!g) return { title: "Guide not found · OAuth Ready" };
  return { title: `${g.appName}: OAuth app guide · OAuth Ready`, description: g.verdict.headline };
}

function Section({ id, title, icon, children, aside }: { id: string; title: string; icon?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {icon}
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
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
      <article className="mx-auto max-w-4xl space-y-10 px-4 py-8">
        {/* Header */}
        <header className="space-y-4">
          <div className="flex items-start gap-3">
            {g.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.logoUrl} alt="" className="mt-1 size-10 rounded-lg border bg-white p-1" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{g.appName}</h1>
              <p className="text-sm text-muted-foreground">
                OAuth app setup &amp; approval guide ·{" "}
                <a href={g.website} target="_blank" rel="noreferrer" className="hover:underline">
                  {g.website.replace(/^https?:\/\//, "")}
                </a>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Researched {g.generatedAt}</span>
            <span>·</span>
            <span>{g.generator.kind === "live" ? "Generated live by agent" : "Library guide"} ({g.generator.by})</span>
            <span>·</span>
            <span>{g.sources.length} sources · {g.claims.length} claims{handsOn ? ` · ${handsOn} hands-on verified` : ""}</span>
          </div>
          <ShareBar slug={g.slug} appName={g.appName} canRegenerate={g.generator.kind === "live"} />
        </header>

        {/* Verdict */}
        <section className="rounded-xl border bg-gradient-to-br from-muted/60 to-background p-5 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TierBadge tier={p.tier} />
            <span className="text-xs text-muted-foreground">for the most common path: {p.name}</span>
          </div>
          <p className="text-lg font-semibold leading-snug md:text-xl">
            {g.verdict.headline}
            <ClaimRefs ids={g.verdict.claimIds} />
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div><div className="text-xs text-muted-foreground">First test login</div><div className="font-semibold">{formatRange(p.timeToFirstLogin)}</div></div>
            <div><div className="text-xs text-muted-foreground">Your active work</div><div className="font-semibold">{formatRange(p.activeEffort)}</div></div>
            <div><div className="text-xs text-muted-foreground">Waiting on provider</div><div className="font-semibold">{p.waitTime.max === 0 ? "None" : formatRange(p.waitTime)}</div></div>
            <div><div className="text-xs text-muted-foreground">Until real users</div><div className="font-semibold">{formatRange(p.timeToProduction)}</div></div>
          </div>
          {p.cost && <p className="mt-3 text-sm"><span className="text-muted-foreground">Cost:</span> {p.cost}</p>}
          <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span><strong>Biggest risk:</strong> {g.verdict.biggestRisk}</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground/85">{g.summary}</p>
        </section>

        {/* Composio shortcut */}
        <Section id="composio" title="Do you need your own OAuth app yet?">
          <div className={cn("rounded-lg border p-4 text-sm", g.composio.status === "managed" ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40" : "bg-card")}>
            <div className="mb-1 font-semibold">
              {g.composio.status === "managed" && "✅ Composio has a managed app for this. You can start building today."}
              {g.composio.status === "bring_your_own" && "Composio has no managed app for this, so this guide is your critical path."}
              {g.composio.status === "not_listed" && "Not in Composio's toolkit directory yet."}
            </div>
            <p className="text-foreground/85">{g.composio.note}</p>
            {g.composio.setupGuideUrl && (
              <a href={g.composio.setupGuideUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline dark:text-sky-400">
                Composio's click-by-click setup walkthrough <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </Section>

        {/* Paths + steps */}
        <Section id="plan" title="Your plan, by path">
          <p className="mb-3 text-sm text-muted-foreground">
            How hard it is depends on what you request and who your users are. Pick the path that matches your product.
            Steps are tagged: 🤖 the agent can do or prepare it · 👤 you must do it · ⏳ you're waiting on the provider.
          </p>
          <PathTabs paths={g.paths} />
        </Section>

        {g.requirements.length > 0 && (
          <Section id="requirements" title="Requirements checklist">
            <RequirementsChecklist slug={g.slug} requirements={g.requirements} paths={g.paths} />
          </Section>
        )}

        {agentNuances.length > 0 && (
          <Section id="agents" title="If you're building an AI agent" icon={<Bot className="size-5 text-violet-600" />}>
            <ul className="space-y-2">
              {agentNuances.map((n) => (
                <li key={n.title} className={cn("rounded-lg border p-3 text-sm", n.severity === "blocker" && "border-rose-300 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30")}>
                  <div className="font-semibold">{n.severity === "blocker" ? "⛔ " : n.severity === "warn" ? "⚠ " : ""}{n.title}</div>
                  <p className="text-foreground/85">{n.detail}<ClaimRefs ids={n.claimIds} /></p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {otherNuances.length > 0 && (
          <Section id="nuances" title="Other nuances">
            <ul className="space-y-2">
              {otherNuances.map((n) => (
                <li key={n.title} className="rounded-lg border p-3 text-sm">
                  <div className="font-semibold">{n.severity === "blocker" ? "⛔ " : n.severity === "warn" ? "⚠ " : ""}{n.title}</div>
                  <p className="text-foreground/85">{n.detail}<ClaimRefs ids={n.claimIds} /></p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {g.blockers.length > 0 && (
          <Section id="stuck" title="If you get stuck" icon={<HelpCircle className="size-5" />}>
            <div className="space-y-2">
              {g.blockers.map((b) => (
                <details key={b.symptom} className="group rounded-lg border p-3 text-sm open:bg-muted/30">
                  <summary className="cursor-pointer list-none font-medium">
                    <span className="mr-1 inline-block transition group-open:rotate-90">›</span> {b.symptom}
                  </summary>
                  <div className="mt-2 space-y-1 pl-4">
                    <p><span className="text-muted-foreground">Likely cause:</span> {b.cause}</p>
                    <p><span className="text-muted-foreground">What to do:</span> {b.fix}<ClaimRefs ids={b.claimIds} /></p>
                    {b.escalation && <p><span className="text-muted-foreground">Escalate:</span> {b.escalation}</p>}
                  </div>
                </details>
              ))}
            </div>
          </Section>
        )}

        {g.handoffKit.length > 0 && (
          <Section id="handoff" title="Agent handoff kit" icon={<Bot className="size-5" />}>
            <p className="mb-3 text-sm text-muted-foreground">Prepared by the agent. Review it, then paste it into the provider's console or review forms.</p>
            <div className="space-y-3">
              {g.handoffKit.map((h) => (
                <div key={h.title} className="overflow-hidden rounded-lg border">
                  <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2">
                    <span className="text-sm font-medium">{h.title}</span>
                    <CopyButton value={h.content} />
                  </div>
                  {h.description && <p className="px-3 pt-2 text-xs text-muted-foreground">{h.description}</p>}
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed">{h.content}</pre>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Evidence */}
        <Section id="evidence" title="Evidence & uncertainty" icon={<ShieldCheck className="size-5" />}>
          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[])
              .filter((s) => stats.get(s))
              .map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 text-xs">
                  <StatusPill status={s} /> × {stats.get(s)}
                </span>
              ))}
          </div>

          {overlay && (
            <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50/50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="mb-1 flex items-center gap-1.5 font-semibold"><FlaskConical className="size-4" /> Hands-on attempts</div>
              <ul className="list-disc space-y-1 pl-5">
                {overlay.attempts.map((a) => (
                  <li key={a.date + a.what}><strong>{a.date}:</strong> {a.what}. {a.outcome}</li>
                ))}
              </ul>
              <a href="/verification" className="mt-1 inline-block text-xs text-sky-700 hover:underline dark:text-sky-400">Full verification log →</a>
            </div>
          )}

          {g.unknowns.length > 0 && (
            <div className="mb-4 rounded-lg border border-dashed p-3 text-sm">
              <div className="mb-1 font-semibold">What we couldn't verify</div>
              <ul className="list-disc space-y-1 pl-5 text-foreground/85">
                {g.unknowns.map((u) => <li key={u}>{u}</li>)}
              </ul>
            </div>
          )}

          {g.probes.length > 0 && (
            <div className="mb-4 overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr><th className="p-2">Live probe</th><th className="p-2">Result</th><th className="p-2">When</th></tr>
                </thead>
                <tbody className="divide-y">
                  {g.probes.map((pr) => (
                    <tr key={pr.check}>
                      <td className="p-2 align-top font-medium">{pr.ok ? "✅" : "➖"} {pr.check}<div className="break-all font-normal text-muted-foreground">{pr.target}</div></td>
                      <td className="p-2 align-top">{pr.result}</td>
                      <td className="whitespace-nowrap p-2 align-top text-muted-foreground">{pr.at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">All {g.claims.length} claims, strongest evidence first</summary>
            <ul className="mt-3 space-y-3">
              {[...g.claims].sort((a, b) => STATUS_META[a.status].rank - STATUS_META[b.status].rank).map((c) => (
                <li key={c.id} className="rounded-md border p-3"><ClaimDetail claim={c} /></li>
              ))}
            </ul>
          </details>

          <div className="mt-4">
            <div className="mb-1 text-sm font-semibold">Sources</div>
            <ul className="space-y-1 text-xs">
              {g.sources.map((s) => (
                <li key={s.url} className="flex gap-2">
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", s.kind === "official" ? "bg-sky-100 text-sky-800" : s.kind === "composio" ? "bg-violet-100 text-violet-800" : "bg-amber-100 text-amber-900")}>{s.kind}</span>
                  <a href={s.url} target="_blank" rel="noreferrer" className="break-all text-sky-700 hover:underline dark:text-sky-400">{s.title}</a>
                  {s.fetchedAt && <span className="shrink-0 text-muted-foreground">{s.fetchedAt}</span>}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </article>
    </ClaimsProvider>
  );
}
