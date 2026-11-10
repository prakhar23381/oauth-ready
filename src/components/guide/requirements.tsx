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
      <ul className="divide-y border-y">
        {requirements.map((r) => (
          <li key={r.item} className="flex items-start gap-3 py-3.5">
            <Checkbox checked={!!checked[r.item]} onCheckedChange={(v) => toggle(r.item, !!v)} className="mt-1" aria-label={r.item} />
            <div className="min-w-0">
              <div>
                {r.item}
                <ClaimRefs ids={r.claimIds} />
              </div>
              <div className="text-sm text-muted-foreground">{r.detail}</div>
              <div className="meta-mono mt-1 text-subtle-foreground">Needed for: {r.requiredFor.map(pathName).join(" · ")}</div>
            </div>
          </li>
        ))}
      </ul>
      <p className="meta-mono mt-2 text-subtle-foreground">
        {done}/{requirements.length} ready · saved in this browser only
      </p>
    </div>
  );
}
