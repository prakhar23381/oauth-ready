import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OAuth Ready: how long until your users can connect?",
  description:
    "Evidence-graded guides for creating a provider OAuth app and getting it approved: time, effort, review, blockers, and what an agent can do for you.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}>
        <TooltipProvider>
          <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur print:hidden">
            <nav className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 text-sm sm:gap-6">
              <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
                <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-[11px] font-bold text-background">OR</span>
                <span className="hidden sm:inline">OAuth Ready</span>
              </Link>
              <Link href="/#library" className="whitespace-nowrap text-muted-foreground hover:text-foreground">Library</Link>
              <Link href="/verification" className="whitespace-nowrap text-muted-foreground hover:text-foreground">Verification</Link>
              <Link href="/about" className="whitespace-nowrap text-muted-foreground hover:text-foreground">How it works</Link>
            </nav>
          </header>
          <main>{children}</main>
          <footer className="mx-auto max-w-5xl px-4 py-10 text-xs text-muted-foreground print:hidden">
            Built for the Composio APM Integrations take-home. Guides can be wrong or out of date: check the evidence badges and the dates.
          </footer>
        </TooltipProvider>
      </body>
    </html>
  );
}
