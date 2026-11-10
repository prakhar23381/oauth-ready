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
  const def = paths.find((p) => p.isDefault) ?? paths[0];
  const pathName = (id: string) => paths.find((p) => p.id === id)?.name ?? id;
  return (
    <ul className="divide-y border-y">
      {requirements.map((r) => {
        const forDefault = r.requiredFor.includes("all") || r.requiredFor.includes(def.id);
        return (
          <li key={r.item}>
            <label className="flex cursor-pointer items-start gap-3 py-3">
              <Checkbox checked={!!checked[r.item]} onCheckedChange={(v) => toggle(r.item, !!v)} className="mt-1" />
              <span className="min-w-0">
                <span className={checked[r.item] ? "text-muted-foreground line-through" : undefined}>{r.item}</span>
                <ClaimRefs ids={r.claimIds} />
                <span className="block text-sm text-muted-foreground">
                  {r.detail}
                  {!forDefault && ` Only for: ${r.requiredFor.map(pathName).join(", ").toLowerCase()}.`}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
