import type { Metadata } from "next";
import Link from "next/link";
import { Chip } from "@/components/chip";
import { STATUS_META, TIER_META } from "@/lib/ui-meta";

export const metadata: Metadata = { title: "How it works · OAuth Ready" };

const STAGES = [
  ["Identify", "Confirms the query is a real product, finds its official domains and plans the searches."],
  ["Search", "Runs six web searches and selects official documentation and developer reports."],
  ["Read", "Extracts facts from each page. Every fact carries a verbatim quote and its source."],
  ["Follow up", "Reviews what is missing and runs up to three more searches."],
  ["Write", "Writes the plan, prerequisites and drafts from the extracted facts only. It can cite facts and sources, not invent links."],
  ["Verify", "Checks each quote against the page text. Quotes that do not match are marked unverified."],
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-8">
      <h2 className="text-[22px] leading-tight tracking-[-0.01em]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
      <header className="max-w-[720px]">
        <h1 className="text-[32px] leading-[1.15] tracking-[-0.02em]">How it works</h1>
        <p className="mt-2 text-muted-foreground">
          A developer building an AI agent needs to know how long it takes before users can connect an app, and what stands in the way. OAuth Ready answers that for any
          provider, and shows the evidence behind each statement.
        </p>
      </header>

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <Block title="The research agent">
          <ol className="divide-y border-y">
            {STAGES.map(([name, text], i) => (
              <li key={name} className="grid grid-cols-[2rem_6.5rem_1fr] gap-x-2 py-3 text-sm">
                <span className="meta-mono pt-0.5 text-subtle-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span>{name}</span>
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">
            Alongside, it sends credential-free requests to the provider's OAuth endpoints to check discovery documents, PKCE and dynamic registration.
          </p>
        </Block>

        <Block title="Evidence grades">
          <ul className="divide-y border-y">
            {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((k) => (
              <li key={k} className="grid grid-cols-[10.5rem_1fr] items-baseline gap-x-3 py-3 text-sm">
                <span>
                  <Chip tone={STATUS_META[k].tone}>{STATUS_META[k].label}</Chip>
                </span>
                <span className="text-muted-foreground">{STATUS_META[k].description}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Difficulty tiers">
          <ul className="divide-y border-y">
            {([1, 2, 3, 4] as const).map((t) => (
              <li key={t} className="grid grid-cols-[10.5rem_1fr] items-baseline gap-x-3 py-3 text-sm">
                <span>
                  <Chip tone={TIER_META[t].tone}>
                    Tier {t} · {TIER_META[t].label}
                  </Chip>
                </span>
                <span className="text-muted-foreground">{TIER_META[t].blurb}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">A tier belongs to a path, not a provider. The same provider can be self-serve for one set of scopes and need a formal review for another.</p>
        </Block>

        <Block title="Limits">
          <ul className="divide-y border-y text-sm text-muted-foreground">
            {[
              "The agent reads public pages only. It does not sign in to provider consoles or submit reviews.",
              "Review times are ranges. Providers publish few figures and developer reports vary.",
              "Effort estimates are judgement and are labelled as estimates.",
              "Live guides are written by free-tier models and are not reviewed by a person. Library guides are.",
              "Guides go out of date. Each shows the date it was researched.",
            ].map((t) => (
              <li key={t} className="py-3">{t}</li>
            ))}
          </ul>
          <Link href="/verification" className="mt-3 inline-block text-sm text-brand-ink hover:underline">See what was checked and corrected</Link>
        </Block>
      </div>
    </div>
  );
}
