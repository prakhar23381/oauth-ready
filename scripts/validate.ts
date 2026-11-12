// Validate every library guide + overlay against the schema and check claim references.
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { Guide, VerificationOverlay } from "../src/lib/schema/guide";

let failed = false;
const dir = (d: string) => path.join(process.cwd(), "data", d);
for (const f of readdirSync(dir("guides")).filter((f) => f.endsWith(".json"))) {
  const r = Guide.safeParse(JSON.parse(readFileSync(path.join(dir("guides"), f), "utf8")));
  if (!r.success) { failed = true; console.error(`✗ ${f}\n`, r.error.issues.slice(0, 8)); continue; }
  const g = r.data;
  const ids = new Set(g.claims.map((c) => c.id));
  const refs = [
    ...g.verdict.claimIds,
    ...g.paths.flatMap((p) => [...p.claimIds, ...p.steps.flatMap((s) => s.claimIds)]),
    ...g.requirements.flatMap((x) => x.claimIds),
    ...g.nuances.flatMap((x) => x.claimIds),
    ...g.blockers.flatMap((x) => x.claimIds),
  ];
  const missing = [...new Set(refs.filter((id) => !ids.has(id)))];
  const unused = [...ids].filter((id) => !refs.includes(id));
  if (missing.length) { failed = true; console.error(`✗ ${f}: missing claim ids`, missing); }
  console.log(`✓ ${f}: ${g.paths.length} paths, ${g.claims.length} claims${unused.length ? ` (unreferenced: ${unused.join(", ")})` : ""}`);
}
try {
  // findings.json and quote-check.json are logs, not per-app overlays.
  for (const f of readdirSync(dir("verification")).filter((f) => f.endsWith(".json") && !["findings.json", "quote-check.json"].includes(f))) {
    const r = VerificationOverlay.safeParse(JSON.parse(readFileSync(path.join(dir("verification"), f), "utf8")));
    if (!r.success) { failed = true; console.error(`✗ overlay ${f}`, r.error.issues.slice(0, 5)); } else console.log(`✓ overlay ${f}`);
  }
} catch {}
process.exit(failed ? 1 : 0);
