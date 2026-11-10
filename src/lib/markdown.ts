import { formatRange, type Guide, type Claim } from "@/lib/schema/guide";
import { OWNER_META, STATUS_META, TIER_META } from "@/lib/ui-meta";

/** Portable Markdown version of a guide (for Slack/Notion/GitHub sharing). */
export function guideToMarkdown(g: Guide, baseUrl = ""): string {
  const claims = new Map(g.claims.map((c) => [c.id, c]));
  const refs = (ids: string[] = []) => {
    const cs = ids.map((id) => claims.get(id)).filter((c): c is Claim => !!c);
    return cs.length ? " " + cs.map((c) => `[${STATUS_META[c.status].label}](${c.sources[0]?.url ?? "#"})`).join(" ") : "";
  };
  const L: string[] = [];
  L.push(`# ${g.appName}: OAuth app setup & approval guide`, "");
  L.push(`> ${g.verdict.headline}`, "");
  L.push(`*Researched ${g.generatedAt} · ${g.generator.by} · ${g.claims.length} claims, ${g.sources.length} sources*${baseUrl ? ` · [Live guide](${baseUrl}/guides/${g.slug})` : ""}`, "");
  L.push(g.summary, "");
  L.push(`**Biggest risk:** ${g.verdict.biggestRisk}`, "");
  L.push(`## Do you need your own OAuth app yet?`, "", g.composio.note, "");
  for (const p of g.paths) {
    L.push(`## Path: ${p.name}${p.isDefault ? " (most common)" : ""}`, "");
    L.push(`*${p.whenThisApplies}*`, "");
    L.push(`| Tier | First test login | Your active work | Waiting on provider | Until real users |`, `|---|---|---|---|---|`);
    L.push(`| ${p.tier} · ${TIER_META[p.tier].label} | ${formatRange(p.timeToFirstLogin)} | ${formatRange(p.activeEffort)} | ${p.waitTime.max === 0 ? "None" : formatRange(p.waitTime)} | ${formatRange(p.timeToProduction)} |`, "");
    if (p.cost) L.push(`**Cost:** ${p.cost}`, "");
    p.steps.forEach((s, i) => {
      L.push(`${i + 1}. **${OWNER_META[s.owner].emoji} ${s.title}**${s.estTime ? ` (~${formatRange(s.estTime)})` : ""}: ${s.detail}${refs(s.claimIds)}`);
      s.copyValues.forEach((cv) => L.push(`   - ${cv.label}: \`${cv.value}\``));
      s.gotchas.forEach((x) => L.push(`   - ⚠ ${x}`));
      s.links.forEach((l) => L.push(`   - [${l.label}](${l.url})`));
    });
    L.push("");
  }
  if (g.requirements.length) {
    L.push(`## Requirements checklist`, "");
    g.requirements.forEach((r) => L.push(`- [ ] **${r.item}**: ${r.detail}${refs(r.claimIds)}`));
    L.push("");
  }
  if (g.nuances.length) {
    L.push(`## Nuances & gotchas`, "");
    g.nuances.forEach((n) => L.push(`- ${n.forAgents ? "🤖 **[AI agents]** " : ""}**${n.title}**: ${n.detail}${refs(n.claimIds)}`));
    L.push("");
  }
  if (g.blockers.length) {
    L.push(`## If you get stuck`, "", `| Symptom | Likely cause | What to do |`, `|---|---|---|`);
    g.blockers.forEach((b) => L.push(`| ${b.symptom} | ${b.cause} | ${b.fix}${b.escalation ? ` Escalate: ${b.escalation}` : ""} |`));
    L.push("");
  }
  if (g.unknowns.length) {
    L.push(`## What we couldn't verify`, "");
    g.unknowns.forEach((u) => L.push(`- ${u}`));
    L.push("");
  }
  L.push(`## Sources`, "");
  g.sources.forEach((s) => L.push(`- [${s.title}](${s.url}) (${s.kind}${s.fetchedAt ? `, fetched ${s.fetchedAt}` : ""})`));
  return L.join("\n");
}
