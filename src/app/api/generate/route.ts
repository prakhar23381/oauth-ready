import { getLibraryGuide, listLibraryGuides } from "@/lib/guides";
import { checkGenerateLimit, getGeneratedGuide, hasDurableStore, saveGeneratedGuide } from "@/lib/store";
import { normalizeAppName } from "@/lib/composio-directory";
import { researchGuide, slugify } from "@/lib/agent/pipeline";
import { PublicError, type AgentEvent } from "@/lib/agent/events";
import { log } from "@/lib/store";
import { z } from "zod";
import { clientIp, crossSiteReason } from "@/lib/request";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({ query: z.string(), force: z.boolean().optional() });

/** POST {query, force?} → newline-delimited JSON stream of AgentEvent. */
export async function POST(req: Request) {
  const reason = crossSiteReason(req);
  if (reason) {
    log("generate.rejected", { reason }, "warn");
    return Response.json({ error: reason === "unsupported_content_type" ? "Send the request as application/json." : "Cross-site requests are not allowed." }, { status: reason === "unsupported_content_type" ? 415 : 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const query = parsed.success ? parsed.data.query.trim().slice(0, 80) : "";
  if (query.length < 2) return Response.json({ error: "Enter an app name or website." }, { status: 400 });
  const body = parsed.data!;
  const runId = crypto.randomUUID().slice(0, 8);

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
        if (!hasDurableStore()) return emit({ type: "error", message: "Live research is unavailable on this deployment because no storage is configured. Library guides remain available." });
        const ip = clientIp(req);
        const refused = await checkGenerateLimit(ip);
        if (refused) {
          log("generate.limited", { runId, query });
          return emit({ type: "error", message: refused });
        }
        log("generate.start", { runId, query });
        const { guide } = await researchGuide(query, emit);
        if (await getLibraryGuide(guide.slug)) return emit({ type: "done", slug: guide.slug, cached: true, ms: Date.now() - started });
        await saveGeneratedGuide(guide);
        emit({ type: "done", slug: guide.slug, cached: false, ms: Date.now() - started });
        log("generate.done", { runId, query, slug: guide.slug, ms: Date.now() - started, claims: guide.claims.length });
      } catch (e) {
        log("generate.failed", { runId, query, ms: Date.now() - started, error: (e as Error).message }, "error");
        // Messages written for users pass through; anything else (provider errors, bugs) stays in the log.
        emit({ type: "error", message: e instanceof PublicError ? e.message : `The research run failed. Try again in a minute. (Reference: ${runId})` });
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
