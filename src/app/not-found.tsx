import Link from "next/link";
import { SearchForm } from "@/components/search-form";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
      <h1 className="text-[32px] leading-[1.15] tracking-[-0.02em]">Guide not found</h1>
      <p className="mt-1 text-muted-foreground">
        No guide exists at this address. Research the app, or return to the <Link href="/" className="text-brand-ink hover:underline">library</Link>.
      </p>
      <div className="mt-7">
        <SearchForm />
      </div>
    </div>
  );
}
