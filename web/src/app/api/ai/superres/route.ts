import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Hugging Face Inference super-resolution via Real-ESRGAN (or similar) proxy.
// Falls back to original tile on any error.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    const upstream = await fetch(url, { next: { revalidate: 0 } });
    if (!upstream.ok) return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    const inputBytes = await upstream.arrayBuffer();

    const HF_API_TOKEN = process.env.HF_API_TOKEN;
    const HF_MODEL = process.env.HF_SR_MODEL || "akhaliq/Real-ESRGAN";

    if (!HF_API_TOKEN) {
      // no token set: return original
      return new NextResponse(inputBytes, {
        status: 200,
        headers: { "content-type": upstream.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=60" },
      });
    }

    const hfRes = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
      body: Buffer.from(inputBytes),
    });

    if (!hfRes.ok) {
      // fallback to original tile
      return new NextResponse(inputBytes, {
        status: 200,
        headers: { "content-type": upstream.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=60" },
      });
    }

    const outBytes = await hfRes.arrayBuffer();
    return new NextResponse(outBytes, {
      status: 200,
      headers: { "content-type": "image/png", "cache-control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json({ error: "Proxy failure" }, { status: 500 });
  }
}
