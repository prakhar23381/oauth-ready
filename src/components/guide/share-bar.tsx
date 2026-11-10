"use client";

import { useState } from "react";
import { Check, FileText, Link2, RefreshCw } from "lucide-react";

const base = "inline-flex h-9 items-center gap-2 px-3.5 text-sm font-medium [&_svg]:size-4";
const primary = `${base} bg-primary text-primary-foreground hover:bg-primary/85`;
const secondary = `${base} border border-input bg-card hover:bg-accent`;
const ghost = `${base} text-muted-foreground hover:bg-accent hover:text-foreground`;

export function ShareBar({ slug, appName, canRegenerate }: { slug: string; appName: string; canRegenerate: boolean }) {
  const [copied, setCopied] = useState<"link" | "md" | null>(null);
  const flash = (k: "link" | "md") => {
    setCopied(k);
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        className={primary}
        onClick={async () => {
          await navigator.clipboard.writeText(`${location.origin}/guides/${slug}`);
          flash("link");
        }}
      >
        {copied === "link" ? <Check /> : <Link2 />} {copied === "link" ? "Link copied" : "Share link"}
      </button>
      <button
        type="button"
        className={secondary}
        onClick={async () => {
          const res = await fetch(`/api/guides/${slug}?format=md`);
          await navigator.clipboard.writeText(await res.text());
          flash("md");
        }}
      >
        {copied === "md" ? <Check /> : <FileText />} {copied === "md" ? "Markdown copied" : "Copy as Markdown"}
      </button>
      {canRegenerate && (
        <a className={ghost} href={`/generate?q=${encodeURIComponent(appName)}&force=1`}>
          <RefreshCw /> Regenerate
        </a>
      )}
    </div>
  );
}
