import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { Guide, VerificationOverlay, isSlug } from "@/lib/schema/guide";
import { getGeneratedGuide } from "@/lib/store";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJsonDir<T>(dir: string, parse: (x: unknown) => T): Promise<T[]> {
  let files: string[] = [];
  try {
    files = (await fs.readdir(path.join(DATA_DIR, dir))).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: T[] = [];
  for (const f of files) {
    const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, dir, f), "utf8"));
    out.push(parse(raw));
  }
  return out;
}

export async function listLibraryGuides(): Promise<Guide[]> {
  const guides = await readJsonDir("guides", (x) => Guide.parse(x));
  return guides.sort((a, b) => a.appName.localeCompare(b.appName));
}

export async function getLibraryGuide(slug: string): Promise<Guide | null> {
  if (!isSlug(slug)) return null;
  try {
    const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, "guides", `${slug}.json`), "utf8"));
    return Guide.parse(raw);
  } catch {
    return null;
  }
}

export async function getOverlay(slug: string): Promise<VerificationOverlay | null> {
  if (!isSlug(slug)) return null;
  try {
    const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, "verification", `${slug}.json`), "utf8"));
    return VerificationOverlay.parse(raw);
  } catch {
    return null;
  }
}

export async function listOverlays(): Promise<VerificationOverlay[]> {
  // The folder also holds quote-check.json and findings.json, which are not overlays.
  const all = await readJsonDir("verification", (x) => VerificationOverlay.safeParse(x));
  return all.filter((r) => r.success).map((r) => r.data!);
}

export type QuoteCheck = { summary: { checkedAt: string; total: number; matched: number; notFound: number; unreachable: number }; rows: { slug: string; claimId: string; url: string; quote: string; result: "matched" | "not_found" | "unreachable" }[] };
export type Findings = {
  updatedAt: string;
  findings: { kind: "corrected" | "unverifiable" | "limitation" | "confirmed"; scope: string; title: string; detail: string; source: string | null }[];
  agentRuns: { app: string; seconds: number; facts: number; quotesMatched: number; note: string }[];
};
async function readVerification<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, "verification", file), "utf8")) as T;
  } catch {
    return null;
  }
}
export const getQuoteCheck = () => readVerification<QuoteCheck>("quote-check.json");
export const getFindings = () => readVerification<Findings>("findings.json");

/** Library first (curated), then live-generated store. */
export async function getGuide(slug: string): Promise<Guide | null> {
  if (!isSlug(slug)) return null;
  return (await getLibraryGuide(slug)) ?? (await getGeneratedGuide(slug));
}
