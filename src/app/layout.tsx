import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, ThemeToggle } from "@/components/theme";
import "./globals.css";

// DESIGN.md: exactly two faces. Geist Sans (400/500) and JetBrains Mono.
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  openGraph: { siteName: "OAuth Ready", type: "website" },
  title: "OAuth Ready: how long until your users can connect?",
  description:
    "Evidence-graded guides for creating a provider OAuth app and getting it approved: time, effort, review, blockers, and what an agent can do for you.",
};

const navLink = "label-mono whitespace-nowrap text-muted-foreground hover:text-foreground";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <TooltipProvider>
            <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur print:hidden">
              <nav className="mx-auto flex h-14 max-w-[1240px] items-center gap-5 px-4 sm:gap-7 sm:px-6">
                <Link href="/" className="flex shrink-0 items-center gap-2.5 font-medium">
                  <span className="flex size-5 items-center justify-center bg-foreground font-mono text-[9px] font-bold text-background">OR</span>
                  <span className="hidden sm:inline">OAuth Ready</span>
                </Link>
                <Link href="/#library" className={navLink}>Library</Link>
                <Link href="/verification" className={navLink}>Verification</Link>
                <Link href="/about" className={navLink}>How it works</Link>
                <span className="ml-auto"><ThemeToggle /></span>
              </nav>
            </header>
            <main>{children}</main>
            <footer className="mx-auto max-w-[1240px] border-t px-4 py-8 text-[13px] text-muted-foreground sm:px-6 print:hidden">
              Independent project. Not affiliated with or endorsed by Composio. Verify time-sensitive details against the cited sources.
            </footer>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
