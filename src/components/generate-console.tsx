"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Loader } from "lucide-react";
import type { AgentEvent, Stage } from "@/lib/agent/events";
import { Tip } from "@/components/tip";
import { cn } from "@/lib/utils";

const STAGES: { id: Stage; label: string; tip: string }[] = [
  { id: "identify", label: "Identify", tip: "Identifies the provider and its official domains, then plans the searches." },
  { id: "search", label: "Search", tip: "Searches the web and selects official documentation and developer reports." },
  { id: "read", label: "Read", tip: "Reads each page and extracts facts, each with a verbatim quote." },
  { id: "followup", label: "Follow up", tip: "Reviews coverage and runs further searches for anything missing." },
  { id: "write", label: "Write", tip: "Writes the plan, prerequisites and draft materials from the extracted facts only." },
  { id: "verify", label: "Verify", tip: "Checks every quote against the text of the page it came from." },
];

type Line = { t: number; kind: string; text: string; tone?: "ok" | "warn" | "muted" };

function toLine(e: AgentEvent, t: number): Line | null {
  switch (e.type) {
    case "search":
      return { t, kind: "search", text: e.query };
    case "source":
      return { t, kind: "read", text: e.url.replace(/^https?:\/\/(www\.)?/, ""), tone: e.official ? undefined : "muted" };
    case "fact":
      return { t, kind: "fact", text: e.claim };
    case "probe":
      return { t, kind: "probe", text: `${e.check}: ${e.result}`, tone: e.ok ? "ok" : "muted" };
    case "wait":
      return { t, kind: "wait", text: `Free-tier rate limit. Resuming in about ${Math.ceil(e.ms / 1000)}s.`, tone: "warn" };
    case "stage":
      return e.status === "done" && e.note ? { t, kind: e.stage, text: e.note, tone: "ok" } : null;
    case "note":
      return { t, kind: "note", text: e.message, tone: "muted" };
    default:
      return null;
  }
}

export function GenerateConsole({ query, force }: { query: string; force: boolean }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [stage, setStage] = useState<Record<string, "start" | "done">>({});
  const [counts, setCounts] = useState({ sources: 0, facts: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t0 = Date.now();
    setLines([]);
    setStage({});
    setCounts({ sources: 0, facts: 0 });
    setError(null);
    setDone(false);
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    const stop = () => clearInterval(tick);

    // Set once a final event (done or error) arrives. A stream that ends without one was cut off,
    // for example by the platform's function time limit.
    let finished = false;
    const handle = (e: AgentEvent) => {
      if (e.type === "done" || e.type === "error") finished = true;
      const t = (Date.now() - t0) / 1000;
      if (e.type === "stage") setStage((s) => ({ ...s, [e.stage]: e.status }));
      if (e.type === "source") setCounts((c) => ({ ...c, sources: c.sources + 1 }));
      if (e.type === "fact") setCounts((c) => ({ ...c, facts: c.facts + 1 }));
      if (e.type === "error") {
        setError(e.message);
        stop();
      }
      if (e.type === "done") {
        setDone(true);
        stop();
        router.replace(`/guides/${e.slug}`);
      }
      const line = toLine(e, t);
      if (line) setLines((l) => [...l, line]);
    };

    (async () => {
      try {
        const res = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, force: force || attempt > 0 }), signal: ctrl.signal });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `Request failed (HTTP ${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done: end, value } = await reader.read();
          if (end) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const raw = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (!raw.trim()) continue;
            let event: AgentEvent;
            try {
              event = JSON.parse(raw) as AgentEvent;
            } catch {
              throw new Error("The server sent an unreadable response.");
            }
            handle(event);
          }
        }
        if (!finished) throw new Error("The research run ended without a result. It may have exceeded the time limit.");
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setError((e as Error).message);
          stop();
        }
      }
    })();
    return () => {
      ctrl.abort();
      stop();
    };
  }, [query, force, attempt, router]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[32px] leading-[1.15] tracking-[-0.02em]">{error ? "Research stopped" : done ? "Guide ready" : `Researching ${query}`}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error ? error : done ? "Opening the guide." : "Usually one to two minutes."}
            {!error && !done && <Tip label="About live research" content="The agent searches the web, reads official documentation and developer reports, checks the provider's OAuth endpoints, and writes the guide from what it found. It runs on free-tier models, so it pauses briefly when a rate limit is reached." />}
          </p>
        </div>
        <dl className="flex gap-8">
          {[
            { label: "Elapsed", value: `${mm}:${ss}` },
            { label: "Sources", value: counts.sources },
            { label: "Facts", value: counts.facts },
          ].map((s) => (
            <div key={s.label} className="text-right">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="font-mono text-xl tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <ol className="flex gap-x-5 gap-y-2 overflow-x-auto lg:flex-col lg:gap-0 lg:border-l">
          {STAGES.map((s) => {
            const st = stage[s.id];
            return (
              <li key={s.id} className={cn("flex shrink-0 items-center gap-2.5 py-1.5 text-sm lg:-ml-px lg:border-l lg:pl-4", st === "start" && !error ? "border-brand text-foreground" : "border-transparent", !st && "text-subtle-foreground", st === "done" && "text-muted-foreground")}>
                {st === "done" ? <Check className="size-3.5 text-success" /> : st === "start" && !error ? <span className="size-2 animate-pulse rounded-full bg-brand" /> : st === "start" ? <CircleAlert className="size-3.5 text-destructive" /> : <span className="size-2 rounded-full border" />}
                {s.label}
                <Tip content={s.tip} label={`About: ${s.label}`} className="ml-0 hidden lg:inline-flex" />
              </li>
            );
          })}
        </ol>

        <div className="border border-code-border bg-code shadow-elevated">
          <div ref={logRef} className="h-[52vh] min-h-72 overflow-y-auto px-4 py-3 font-mono text-[0.8rem] leading-[1.7] text-code-foreground" aria-live="polite">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[3rem_4.5rem_1fr] gap-x-2">
                <span className="text-subtle-foreground tabular-nums">{l.t.toFixed(0).padStart(3, " ")}s</span>
                <span className={cn("text-subtle-foreground", l.tone === "ok" && "text-success", l.tone === "warn" && "text-warning")}>{l.kind}</span>
                <span className={cn("min-w-0 break-words", l.tone === "muted" && "text-muted-foreground", l.tone === "warn" && "text-warning")}>{l.text}</span>
              </div>
            ))}
            {!error && !done && (
              <div className="mt-1 flex items-center gap-2 text-subtle-foreground">
                <Loader className="size-3.5 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="inline-flex h-9 cursor-pointer items-center bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/85">
            Try again
          </button>
          <Link href="/" className="inline-flex h-9 items-center border border-input bg-card px-3.5 text-sm font-medium hover:bg-accent">
            Back to library
          </Link>
        </div>
      )}
    </div>
  );
}
