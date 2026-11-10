import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GenerateConsole } from "@/components/generate-console";

export const metadata: Metadata = { title: "Researching · OAuth Ready" };

export default async function GeneratePage({ searchParams }: { searchParams: Promise<{ q?: string; force?: string }> }) {
  const { q, force } = await searchParams;
  const query = (q ?? "").trim();
  if (!query) redirect("/");
  return <GenerateConsole query={query} force={force === "1"} />;
}
