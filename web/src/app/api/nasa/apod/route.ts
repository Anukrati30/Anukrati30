import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const count = Math.min(parseInt(searchParams.get("count") || "6", 10), 12);
  const API_KEY = process.env.NASA_API_KEY;
  if (!API_KEY) {
    return NextResponse.json({ error: "NASA_API_KEY not set" }, { status: 500 });
  }
  const url = new URL("https://api.nasa.gov/planetary/apod");
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("thumbs", "true");
  url.searchParams.set("count", String(count));

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    return NextResponse.json({ error: "NASA API error" }, { status: 502 });
  }
  const data: unknown = await res.json();
  type ApodRaw = {
    date: string;
    title: string;
    explanation: string;
    url: string;
    thumbnail_url?: string;
    media_type: string;
  };
  const normalized = (Array.isArray(data) ? (data as ApodRaw[]) : [data as ApodRaw]).map((item) => ({
    id: item.date,
    title: item.title,
    explanation: item.explanation,
    url: item.url,
    thumbnail_url: item.thumbnail_url,
    media_type: item.media_type,
    date: item.date,
  }));
  return NextResponse.json(normalized);
}
