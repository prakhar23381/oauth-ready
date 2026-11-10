"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Guide } from "@/lib/schema/guide";
import { Chip } from "@/components/chip";
import { ClaimList } from "./claims";
import { Tip } from "@/components/tip";

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
          <li key={r.item} className="flex items-center gap-3 py-2.5">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
              <Checkbox checked={!!checked[r.item]} onCheckedChange={(v) => toggle(r.item, !!v)} />
              <span className={checked[r.item] ? "text-muted-foreground line-through" : undefined}>{r.item}</span>
            </label>
            {!forDefault && (
              <Tip content={`Required only for: ${r.requiredFor.map(pathName).join(", ").toLowerCase()}.`}>
                <Chip>Other paths</Chip>
              </Tip>
            )}
            <Tip
              wide
              label={`About: ${r.item}`}
              content={
                <>
                  <p>{r.detail}</p>
                  <ClaimList ids={r.claimIds} />
                </>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
