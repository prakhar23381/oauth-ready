import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, CircleHelp, Info, Wrench } from "lucide-react";
import { getFindings, getQuoteCheck, listLibraryGuides, listOverlays } from "@/lib/guides";
import { Chip } from "@/components/chip";
import { Disclosure } from "@/components/disclosure";
import { Tip } from "@/components/tip";
import type { Tone } from "@/lib/ui-meta";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verification log · OAuth Ready", description: "What was checked against real sources and setup attempts, what was corrected, and what could not be verified." };

const KIND: Record<string, { label: string; tone: Tone; icon: React.ReactNode }> = {
  corrected: { label: "Corrected", tone: "warning", icon: <Wrench className="size-4 shrink-0 text-warning" /> },
  confirmed: { label: "Confirmed", tone: "success", icon: <Check className="size-4 shrink-0 text-success" /> },
  unverifiable: { label: "Unverified", tone: "neutral", icon: <CircleHelp className="size-4 shrink-0 text-subtle-foreground" /> },
  limitation: { label: "Limitation", tone: "neutral", icon: <Info className="size-4 shrink-0 text-subtle-foreground" /> },
};

function Section({ title, tip, children }: { title: string; tip?: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-10">
      <h2 className="text-[22px] leading-tight tracking-[-0.01em]">
        {title}
        {tip && <Tip content={tip} label={`About: ${title}`} className="ml-2 align-[-1px]" />}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function VerificationPage() {
  const [quotes, findings, overlays, guides] = await Promise.all([getQuoteCheck(), getFindings(), listOverlays(), listLibraryGuides()]);
  const name = (slug: string) => guides.find((g) => g.slug === slug)?.appName ?? slug;
  const items = findings?.findings ?? [];
  const count = (k: string) => items.filter((f) => f.kind === k).length;
  const handsOnChecks = overlays.flatMap((o) => o.claimChecks.filter((c) => c.method === "hands_on"));
  const attempts = overlays.reduce((n, o) => n + o.attempts.length, 0);
  const bySlug = new Map<string, { total: number; matched: number }>();
  quotes?.rows.forEach((r) => {
    const s = bySlug.get(r.slug) ?? { total: 0, matched: 0 };
    s.total++;
    if (r.result === "matched") s.matched++;
    bySlug.set(r.slug, s);
  });
  const stats = [
    { label: "Quotes matched to source", value: quotes ? `${quotes.summary.matched}/${quotes.summary.total}` : "Not run", tip: "Every quote in the library guides was checked against a fresh copy of the page it cites." },
    { label: "Corrections", value: String(count("corrected")), tip: "Errors found in sources, in the guides or in the agent, and fixed." },
    { label: "Hands-on attempts", value: String(attempts), tip: "Setup attempts made by a person in the provider's console, compared with the guide." },
    { label: "Unverified items", value: String(count("unverifiable")), tip: "Questions that the sources read could not settle. Each is marked in its guide." },
  ];

  return (
    <div className="mx-auto max-w-[1240px] space-y-12 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-[32px] leading-[1.15] tracking-[-0.02em]">Verification log</h1>
        <p className="mt-1 text-muted-foreground">What was checked, what was corrected and what remains unverified.</p>
        <dl className="mt-7 grid grid-cols-2 gap-px border bg-border lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-card p-4">
              <dt className="text-xs text-muted-foreground">
                {s.label}
                <Tip content={s.tip} label={`About: ${s.label}`} />
              </dt>
              <dd className="mt-1 text-[32px] leading-none tracking-[-0.02em] tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid gap-x-12 gap-y-12 lg:grid-cols-2">
        <Section title="Corrections and findings" tip="Recorded while researching the library and testing the agent.">
          <div className="divide-y border-y">
            {items.map((f) => (
              <Disclosure key={f.title} icon={KIND[f.kind].icon} title={f.title} aside={<Chip tone={KIND[f.kind].tone}>{KIND[f.kind].label}</Chip>}>
                <div className="space-y-2 pl-7 text-sm">
                  <p className="text-muted-foreground">{f.detail}</p>
                  <p className="meta-mono text-subtle-foreground">{f.scope}</p>
                  {f.source && (
                    <a href={f.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-ink hover:underline">
                      Source <ArrowUpRight className="size-3.5" />
                    </a>
                  )}
                </div>
              </Disclosure>
            ))}
          </div>
        </Section>

        <div className="space-y-12">
          <Section title="Hands-on attempts" tip="A person followed the guide in the provider's console and recorded where it matched and where it did not.">
            {overlays.length === 0 ? (
              <p className="border-y py-3 text-sm text-muted-foreground">None recorded yet.</p>
            ) : (
              <div className="divide-y border-y">
                {overlays.map((o) => {
                  const corrected = o.claimChecks.filter((c) => c.result === "corrected").length;
                  return (
                    <Disclosure key={o.slug} title={name(o.slug)} aside={<span className="meta-mono text-subtle-foreground">{o.claimChecks.filter((c) => c.result === "confirmed").length} confirmed{corrected ? ` · ${corrected} corrected` : ""}</span>}>
                      <ul className="space-y-3 text-sm">
                        {o.attempts.map((a) => (
                          <li key={a.date + a.what}>
                            <span className="meta-mono mr-2 text-subtle-foreground">{a.date}</span>
                            {a.what}. <span className="text-muted-foreground">{a.outcome}</span>
                          </li>
                        ))}
                        {o.claimChecks.map((c) => (
                          <li key={c.agentSaid} className="border-l-2 pl-3">
                            <Chip tone={c.result === "confirmed" ? "success" : c.result === "corrected" ? "warning" : "neutral"}>{c.result}</Chip>
                            <p className="mt-1">{c.agentSaid}</p>
                            <p className="text-muted-foreground">{c.finding}</p>
                          </li>
                        ))}
                        {o.learned.map((l) => (
                          <li key={l} className="text-muted-foreground">{l}</li>
                        ))}
                      </ul>
                      <Link href={`/guides/${o.slug}`} className="mt-3 inline-block text-sm text-brand-ink hover:underline">Open the guide</Link>
                    </Disclosure>
                  );
                })}
              </div>
            )}
            {handsOnChecks.length > 0 && <p className="meta-mono mt-2 text-subtle-foreground">{handsOnChecks.length} claims checked by hand</p>}
          </Section>

          <Section title="Quote check by guide" tip={quotes ? `Run on ${quotes.summary.checkedAt} with pnpm verify:quotes. Each cited page is fetched again and searched for the quote.` : undefined}>
            <table className="w-full border-y text-left text-sm">
              <tbody className="divide-y">
                {[...bySlug.entries()].map(([slug, s]) => (
                  <tr key={slug}>
                    <td className="py-2.5">
                      <Link href={`/guides/${slug}`} className="hover:underline">{name(slug)}</Link>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {s.matched}/{s.total}
                    </td>
                    <td className="w-8 py-2.5 text-right">{s.matched === s.total ? <Check className="ml-auto size-4 text-success" /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {findings && findings.agentRuns.length > 0 && (
            <Section title="Live agent test runs" tip="Runs of the research agent on apps outside the library. Quotes that do not match their source page are shown as unverified in the generated guide.">
              <table className="w-full border-y text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 font-normal">App</th>
                    <th className="py-2 text-right font-normal">Time</th>
                    <th className="py-2 text-right font-normal">Quotes matched</th>
                    <th className="w-8">
                      <span className="sr-only">Notes</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {findings.agentRuns.map((r) => (
                    <tr key={r.app}>
                      <td className="py-2.5">{r.app}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums">{r.seconds}s</td>
                      <td className="py-2.5 text-right font-mono tabular-nums">{r.facts ? `${r.quotesMatched}/${r.facts}` : "n/a"}</td>
                      <td className="py-2.5 text-right">
                        <Tip content={r.note} label={`About the ${r.app} run`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
