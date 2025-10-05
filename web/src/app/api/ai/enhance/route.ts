import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    let inputBytes: ArrayBuffer;
    let contentType = "image/jpeg";

    if (url.startsWith("/")) {
      const localPath = path.join(process.cwd(), "public", url.slice(1));
      const buf = await fs.readFile(localPath);
      inputBytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      // quick type guess by ext
      if (url.toLowerCase().endsWith(".png")) contentType = "image/png";
    } else {
      const res = await fetch(url);
      if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
      contentType = res.headers.get("content-type") || contentType;
      inputBytes = await res.arrayBuffer();
    }

    const HF_API_TOKEN = process.env.HF_API_TOKEN;
    const HF_MODEL = process.env.HF_SR_MODEL || "akhaliq/Real-ESRGAN";

    if (!HF_API_TOKEN) {
      return NextResponse.json({ error: "HF_API_TOKEN not set" }, { status: 500 });
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
      return NextResponse.json({ error: "HF inference failed" }, { status: 502 });
    }

    const outBytes = Buffer.from(await hfRes.arrayBuffer());
    const outDir = path.join(process.cwd(), "public", "enhanced");
    await fs.mkdir(outDir, { recursive: true });
    const base = path.basename(url).replace(/[^a-zA-Z0-9_.-]/g, "_");
    const nameNoExt = base.replace(/\.[^.]+$/, "");
    const outName = `${Date.now()}-${nameNoExt}-sr.png`;
    const outPath = path.join(outDir, outName);
    await fs.writeFile(outPath, outBytes);

    return NextResponse.json({ url: `/enhanced/${outName}` }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Enhance failure" }, { status: 500 });
  }
}
