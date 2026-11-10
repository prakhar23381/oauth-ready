"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Guide } from "@/lib/schema/guide";
import { ClaimRefs } from "./claims";

export function RequirementsChecklist({ slug, requirements, paths }: { slug: string; requirements: Guide["requirements"]; paths: Guide["paths"] }) {
  const storageKey = `oauth-ready:req:${slug}`;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setChecked(JSON.parse(localStorage.getItem(storageKey) ?? "{}"));
    } catch {}
  }, [storageKey]);
  const toggle = (item: string, v: boolean) => {
    const next = { ...checked, [item]: v };
    setChecked(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };
  const pathName = (id: string) => (id === "all" ? "All paths" : paths.find((p) => p.id === id)?.name ?? id);
  const done = requirements.filter((r) => checked[r.item]).length;
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        {done}/{requirements.length} ready. Your checkmarks are saved in this browser only.
      </p>
      <ul className="divide-y rounded-lg border">
        {requirements.map((r) => (
          <li key={r.item} className="flex items-start gap-3 p-3">
            <Checkbox checked={!!checked[r.item]} onCheckedChange={(v) => toggle(r.item, !!v)} className="mt-0.5" aria-label={r.item} />
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {r.item}
                <ClaimRefs ids={r.claimIds} />
              </div>
              <div className="text-sm text-muted-foreground">{r.detail}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {r.requiredFor.map((id) => (
                  <span key={id} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{pathName(id)}</span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
