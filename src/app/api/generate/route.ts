import { getLibraryGuide, listLibraryGuides } from "@/lib/guides";
import { getGeneratedGuide, saveGeneratedGuide } from "@/lib/store";
import { normalizeAppName } from "@/lib/composio-directory";
import { researchGuide, slugify } from "@/lib/agent/pipeline";
import type { AgentEvent } from "@/lib/agent/events";

export const runtime = "nodejs";
export const maxDuration = 300;

/** POST {query, force?} → newline-delimited JSON stream of AgentEvent. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { query?: string; force?: boolean };
  const query = (body.query ?? "").trim().slice(0, 80);
  if (query.length < 2) return Response.json({ error: "Enter an app name or website." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (e: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          closed = true;
        }
      };
      const started = Date.now();
      try {
        // Curated library guides always win; previously generated guides are reused unless forced.
        const guess = slugify(normalizeAppName(query));
        const library = (await getLibraryGuide(guess)) ?? (await listLibraryGuides()).find((g) => normalizeAppName(g.appName) === normalizeAppName(query) || g.slug === guess);
        if (library) return emit({ type: "done", slug: library.slug, cached: true, ms: 0 });
        if (!body.force) {
          const existing = await getGeneratedGuide(guess);
          if (existing) return emit({ type: "done", slug: existing.slug, cached: true, ms: 0 });
        }
        const { guide } = await researchGuide(query, emit);
        if (await getLibraryGuide(guide.slug)) return emit({ type: "done", slug: guide.slug, cached: true, ms: Date.now() - started });
        await saveGeneratedGuide(guide);
        emit({ type: "done", slug: guide.slug, cached: false, ms: Date.now() - started });
      } catch (e) {
        emit({ type: "error", message: (e as Error).message || "The research run failed." });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
