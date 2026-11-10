"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function SearchForm({ examples = [] }: { examples?: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const go = (value: string) => {
    const v = value.trim();
    if (v.length >= 2) router.push(`/generate?q=${encodeURIComponent(v)}`);
  };
  return (
    <div className="max-w-[520px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="flex"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="App name or website"
          aria-label="App name or website"
          maxLength={80}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 border border-r-0 border-input bg-card px-3.5 outline-none placeholder:text-subtle-foreground focus-visible:border-brand-ink"
        />
        <button type="submit" className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85">
          Research <ArrowRight className="size-4" />
        </button>
      </form>
      {examples.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {examples.map((e) => (
            <button key={e} type="button" onClick={() => go(e)} className="cursor-pointer text-brand-ink hover:underline">
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
