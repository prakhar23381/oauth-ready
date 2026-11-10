"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Tip: detail that opens on hover (desktop), tap (touch) and Enter (keyboard).
 * Built on a popover so it works on phones, where plain hover tooltips don't.
 * With no children it renders a small info icon as the trigger.
 */
export function Tip({ content, children, className, label = "More detail", wide = false }: { content: React.ReactNode; children?: React.ReactNode; className?: string; label?: string; wide?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={120}
        closeDelay={80}
        aria-label={children ? undefined : label}
        className={cn(
          "cursor-help",
          children ? "inline-flex" : "ml-1.5 inline-flex size-4 items-center justify-center align-[-2px] text-subtle-foreground hover:text-foreground data-popup-open:text-foreground",
          className,
        )}
      >
        {children ?? <Info className="size-3.5" />}
      </PopoverTrigger>
      <PopoverContent className={cn("max-h-[min(26rem,70vh)] max-w-[calc(100vw-2rem)] gap-0 overflow-y-auto p-3 text-[13px] leading-normal shadow-elevated ring-border", wide ? "w-96" : "w-72")}>{content}</PopoverContent>
    </Popover>
  );
}

/** Hint: a short hover label for an icon. Safe inside buttons (renders a span). */
export function Hint({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn("inline-flex", className)} />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
