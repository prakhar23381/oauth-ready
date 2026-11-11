import { ChevronRight } from "lucide-react";

/** A row that shows only its title until opened. Keeps secondary detail off the page by default. */
export function Disclosure({ icon, title, aside, children }: { icon?: React.ReactNode; title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 hover:bg-accent/50">
        {icon}
        <span className="min-w-0 flex-1">{title}</span>
        {aside}
        <ChevronRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}
