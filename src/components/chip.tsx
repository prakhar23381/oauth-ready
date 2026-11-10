import { TONE_CLASS, type Tone } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

/** Square mono label chip (DESIGN.md: chip). */
export function Chip({ tone = "neutral", className, children, title }: { tone?: Tone; className?: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("label-mono inline-flex h-5 shrink-0 items-center gap-1 border px-1.5 whitespace-nowrap", TONE_CLASS[tone], className)}>
      {children}
    </span>
  );
}
