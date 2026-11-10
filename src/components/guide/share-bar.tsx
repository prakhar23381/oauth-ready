"use client";

import { useState } from "react";
import { Check, FileText, Link2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareBar({ slug, appName, canRegenerate }: { slug: string; appName: string; canRegenerate: boolean }) {
  const [copied, setCopied] = useState<"link" | "md" | null>(null);
  const flash = (k: "link" | "md") => {
    setCopied(k);
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(`${location.origin}/guides/${slug}`);
          flash("link");
        }}
      >
        {copied === "link" ? <Check /> : <Link2 />} {copied === "link" ? "Link copied" : "Share link"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          const res = await fetch(`/api/guides/${slug}?format=md`);
          await navigator.clipboard.writeText(await res.text());
          flash("md");
        }}
      >
        {copied === "md" ? <Check /> : <FileText />} {copied === "md" ? "Markdown copied" : "Copy as Markdown"}
      </Button>
      {canRegenerate && (
        <Button variant="ghost" size="sm" render={<a href={`/generate?q=${encodeURIComponent(appName)}&force=1`} />}>
          <RefreshCw /> Regenerate
        </Button>
      )}
    </div>
  );
}
