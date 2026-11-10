// Re-fetch every source cited by the library guides and check that each quote appears on the page.
// Writes data/verification/quote-check.json, which the verification page displays.
// usage: pnpm verify:quotes
import { readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { Guide } from "../src/lib/schema/guide";
import { fetchPageText, quoteInText } from "../src/lib/agent/web";

type Row = { slug: string; claimId: string; url: string; quote: string; result: "matched" | "not_found" | "unreachable"; note?: string };
const dir = path.join(process.cwd(), "data", "guides");
const pages = new Map<string, Promise<string | Error>>();
const page = (url: string) => {
  if (!pages.has(url)) pages.set(url, fetchPageText(url).catch((e: Error) => e));
  return pages.get(url)!;
};

async function main() {
  const rows: Row[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const g = Guide.parse(JSON.parse(readFileSync(path.join(dir, f), "utf8")));
    for (const c of g.claims) {
      for (const s of c.sources) {
        if (!s.quote) continue;
        const text = await page(s.url);
        if (text instanceof Error || text.length < 200) rows.push({ slug: g.slug, claimId: c.id, url: s.url, quote: s.quote, result: "unreachable", note: text instanceof Error ? text.message : "page returned no readable text" });
        else rows.push({ slug: g.slug, claimId: c.id, url: s.url, quote: s.quote, result: quoteInText(s.quote, text) ? "matched" : "not_found" });
      }
    }
  }
  const count = (r: Row["result"]) => rows.filter((x) => x.result === r).length;
  const summary = { checkedAt: new Date().toISOString().slice(0, 10), total: rows.length, matched: count("matched"), notFound: count("not_found"), unreachable: count("unreachable") };
  writeFileSync(path.join(process.cwd(), "data", "verification", "quote-check.json"), JSON.stringify({ summary, rows }, null, 2));
  console.log(summary);
  for (const r of rows.filter((x) => x.result !== "matched")) console.log(`${r.result.padEnd(11)} ${r.slug}/${r.claimId}  ${r.quote.slice(0, 70)}  ${r.note ?? ""}`);
}
main();
