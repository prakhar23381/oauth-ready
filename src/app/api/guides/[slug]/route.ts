import { NextResponse } from "next/server";
import { getGuide } from "@/lib/guides";
import { guideToMarkdown } from "@/lib/markdown";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return NextResponse.json({ error: "Guide not found" }, { status: 404 });
  const url = new URL(req.url);
  if (url.searchParams.get("format") === "md") {
    return new NextResponse(guideToMarkdown(guide, url.origin), { headers: { "content-type": "text/markdown; charset=utf-8" } });
  }
  return NextResponse.json(guide);
}
