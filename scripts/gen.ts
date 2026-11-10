// Run the research agent from the terminal.
// usage: pnpm gen "<app name or website>" [--save]
import { researchGuide } from "../src/lib/agent/pipeline";
import { saveGeneratedGuide } from "../src/lib/store";

const query = process.argv[2];
if (!query) {
  console.error('usage: pnpm gen "<app name or website>" [--save]');
  process.exit(1);
}
const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s`;
researchGuide(query, (e) => {
  if (e.type === "fact") console.log(stamp(), "fact  ", `[${e.topic}]`, e.claim.slice(0, 110));
  else if (e.type === "source") console.log(stamp(), "source", e.official ? "official " : "3rd-party", e.url.slice(0, 100));
  else console.log(stamp(), JSON.stringify(e).slice(0, 200));
})
  .then(async ({ guide, ms }) => {
    if (process.argv.includes("--save")) await saveGeneratedGuide(guide);
    const d = guide.paths.find((p) => p.isDefault)!;
    console.log(`\n=== ${guide.appName} in ${(ms / 1000).toFixed(0)}s · ${guide.generator.by}`);
    console.log("headline:", guide.verdict.headline);
    console.log("risk:", guide.verdict.biggestRisk);
    for (const p of guide.paths) console.log(`path: ${p.name} | tier ${p.tier} | prod ${p.timeToProduction.min}-${p.timeToProduction.max} ${p.timeToProduction.unit} | wait ${p.waitTime.min}-${p.waitTime.max} ${p.waitTime.unit} | ${p.steps.length} steps | cost ${p.cost ?? "-"}`);
    console.log("default steps:", d.steps.map((s) => `${s.owner}:${s.title}`).join(" → "));
    console.log(`claims ${guide.claims.length} (unverified ${guide.claims.filter((c) => c.verifiedQuote === false).length}) | reqs ${guide.requirements.length} | considerations ${guide.nuances.length} | troubleshooting ${guide.blockers.length} | materials ${guide.handoffKit.length} | unknowns ${guide.unknowns.length} | probes ${guide.probes.length}`);
  })
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
