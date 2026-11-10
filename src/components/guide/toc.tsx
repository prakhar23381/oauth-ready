"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Sticky section list for wide screens, so a long guide always shows where you are. */
export function Toc({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    const onScroll = () => {
      let current = els[0]?.id;
      for (const el of els) if (el.getBoundingClientRect().top <= 120) current = el.id;
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);
  return (
    <nav aria-label="On this page" className="sticky top-24 hidden max-h-[calc(100vh-8rem)] self-start overflow-y-auto lg:block print:hidden">
      <ul className="space-y-0.5 border-l">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              className={cn("-ml-px block border-l py-1 pl-3 text-[13px] leading-snug", active === i.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
