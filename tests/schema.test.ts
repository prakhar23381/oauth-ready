import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { cleanBasis, defaultPath, formatRange, Guide } from "@/lib/schema/guide";
import { lookupComposio, normalizeAppName } from "@/lib/composio-directory";
import { slugify } from "@/lib/agent/pipeline";

describe("formatRange", () => {
  it("formats ranges, singulars and zero", () => {
    expect(formatRange({ min: 3, max: 12, unit: "weeks", basis: "" })).toBe("3–12 weeks");
    expect(formatRange({ min: 1, max: 1, unit: "days", basis: "" })).toBe("1 day");
    expect(formatRange({ min: 0, max: 0, unit: "minutes", basis: "" })).toBe("Immediate");
    expect(formatRange({ min: 0, max: 5, unit: "days", basis: "" })).toBe("up to 5 days");
  });
});

describe("cleanBasis", () => {
  it("hides internal fact ids", () => {
    expect(cleanBasis("F22")).toBe("Source: cited sources");
    expect(cleanBasis("Facts F3, F7 and F22 state 2–4 weeks")).toBe("cited sources state 2–4 weeks");
    expect(cleanBasis("FAQ says 5 days")).toBe("FAQ says 5 days");
  });
});

describe("library guides", () => {
  const dir = path.join(process.cwd(), "data", "guides");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    it(`${f} is valid, has one default path and resolvable claim references`, () => {
      const g = Guide.parse(JSON.parse(readFileSync(path.join(dir, f), "utf8")));
      expect(g.paths.filter((p) => p.isDefault)).toHaveLength(1);
      expect(defaultPath(g).isDefault).toBe(true);
      const ids = new Set(g.claims.map((c) => c.id));
      for (const p of g.paths) for (const s of p.steps) for (const id of s.claimIds) expect(ids.has(id), `${f}: ${id}`).toBe(true);
      for (const p of g.paths) {
        expect(p.timeToProduction.min).toBeLessThanOrEqual(p.timeToProduction.max);
        if (p.tier === 1) expect(p.waitTime.max).toBe(0);
      }
    });
  }
});

describe("Composio directory lookup", () => {
  it("finds managed, bring-your-own and unknown apps from names, domains and URLs", () => {
    expect(lookupComposio("Gmail").status).toBe("managed");
    expect(lookupComposio("https://www.spotify.com").status).toBe("bring_your_own");
    expect(lookupComposio("X")).toEqual({ status: "bring_your_own", toolkitName: "Twitter" });
    expect(lookupComposio("slack.com").status).toBe("managed");
    expect(lookupComposio("Strava").status).toBe("not_listed");
  });
  it("normalizes case, scheme, www and TLD", () => {
    expect(normalizeAppName("HTTPS://WWW.Notion.SO")).toBe(normalizeAppName("notion.so"));
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Gmail (Google)")).toBe("gmail");
    expect(slugify("Outlook (Microsoft Graph)")).toBe("outlook");
    expect(slugify("  Zoho Books!! ")).toBe("zoho-books");
  });
  it("gives distinct slugs to distinct non-Latin app names", () => {
    // Otherwise two different apps share one stored guide and overwrite each other.
    expect(slugify("微信")).not.toBe(slugify("카카오"));
  });
});
