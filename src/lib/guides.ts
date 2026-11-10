import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { Guide, VerificationOverlay } from "@/lib/schema/guide";
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
  try {
    const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, "guides", `${slug}.json`), "utf8"));
    return Guide.parse(raw);
  } catch {
    return null;
  }
}

export async function getOverlay(slug: string): Promise<VerificationOverlay | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, "verification", `${slug}.json`), "utf8"));
    return VerificationOverlay.parse(raw);
  } catch {
    return null;
  }
}

export async function listOverlays(): Promise<VerificationOverlay[]> {
  return readJsonDir("verification", (x) => VerificationOverlay.parse(x));
}

/** Library first (curated), then live-generated store. */
export async function getGuide(slug: string): Promise<Guide | null> {
  return (await getLibraryGuide(slug)) ?? (await getGeneratedGuide(slug));
}
