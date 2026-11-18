import { listLibraryGuides } from "@/lib/guides";
import { hasDurableStore, storeBackend } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Health and readiness. Reports configuration as booleans only, never values, and makes no external calls.
 * 200 when the library can be served; "degraded" when live research is unavailable.
 */
export async function GET() {
  let libraryGuides = 0;
  try {
    libraryGuides = (await listLibraryGuides()).length;
  } catch {
    libraryGuides = 0;
  }
  const modelKey = !!(process.env.GROQ_API_KEY || process.env.MISTRAL_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  const searchKey = !!process.env.TAVILY_API_KEY;
  const durable = hasDurableStore();
  const liveResearch = modelKey && searchKey && durable;
  const ok = libraryGuides > 0;
  return Response.json(
    {
      status: !ok ? "down" : liveResearch ? "ok" : "degraded",
      library: { guides: libraryGuides },
      liveResearch: { available: liveResearch, modelKey, searchKey, store: storeBackend, durable },
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
