import Link from "next/link";
import { listLibraryGuides } from "@/lib/guides";
import { listRecentGenerated } from "@/lib/store";
import { defaultPath, formatRange, type Guide } from "@/lib/schema/guide";
import { TIER_META } from "@/lib/ui-meta";
import { Chip } from "@/components/chip";
import { SearchForm } from "@/components/search-form";
import { Tip } from "@/components/tip";

export const dynamic = "force-dynamic";

function GuideCard({ g }: { g: Guide }) {
  const p = defaultPath(g);
  const tier = TIER_META[p.tier];
  return (
    <Link href={`/guides/${g.slug}`} className="flex flex-col gap-3 border bg-card p-4 hover:border-foreground">
      <span className="flex items-center gap-2.5">
        {g.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.logoUrl} alt="" className="size-6 border bg-white p-0.5" />
        )}
        <span className="min-w-0 truncate">{g.appName}</span>
      </span>
      <span className="text-2xl leading-none tracking-[-0.015em] tabular-nums">{formatRange(p.timeToProduction)}</span>
      <span className="flex flex-wrap gap-1.5">
        <Chip tone={tier.tone}>
          Tier {p.tier} · {tier.label}
        </Chip>
        {g.composio.status === "managed" && <Chip tone="success">Composio-managed</Chip>}
      </span>
    </Link>
  );
}

export default async function Home() {
  const [library, recent] = await Promise.all([listLibraryGuides(), listRecentGenerated(8)]);
  const librarySlugs = new Set(library.map((g) => g.slug));
  const generated = recent.filter((g) => !librarySlugs.has(g.slug));
  return (
    <div className="mx-auto max-w-[1240px] space-y-14 px-4 py-14 sm:px-6">
      <section>
        <h1 className="max-w-3xl text-[36px] leading-[1.1] tracking-[-0.025em] sm:text-[44px]">How long until your users can connect?</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Setup and approval guides for provider OAuth apps, with every claim graded by its evidence.
          <Tip
            wide
            label="About OAuth Ready"
            content="Enter any app. A research agent reads the provider's documentation and developer reports, checks its OAuth endpoints, and writes a guide covering time to production, the review process, prerequisites and what can be prepared for you. Guides in the library are returned immediately."
          />
        </p>
        <div className="mt-7">
          <SearchForm examples={["Strava", "Pipedrive", "Calendly", "Webflow"]} />
        </div>
      </section>

      <section id="library" className="scroll-mt-24 border-t pt-10">
        <h2 className="text-[22px] leading-tight tracking-[-0.01em]">
          Library
          <Tip label="About the library" className="ml-2 align-[-1px]" content="Reviewed guides. The time shown is the estimated time to production on the most common path." />
        </h2>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {library.map((g) => (
            <GuideCard key={g.slug} g={g} />
          ))}
        </div>
      </section>

      {generated.length > 0 && (
        <section className="border-t pt-10">
          <h2 className="text-[22px] leading-tight tracking-[-0.01em]">
            Recently researched
            <Tip label="About recent guides" className="ml-2 align-[-1px]" content="Generated live by the agent and not yet reviewed by a person." />
          </h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {generated.map((g) => (
              <GuideCard key={g.slug} g={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
