import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Placeholder proxy that returns the original tile unmodified.
// Later: integrate Replicate/HF and cache results.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    const upstream = await fetch(url, { next: { revalidate: 0 } });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: { "content-type": contentType, "cache-control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json({ error: "Proxy failure" }, { status: 500 });
  }
}
