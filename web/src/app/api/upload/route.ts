import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const allowed = ["image/jpeg", "image/png", "image/jpg"];
  const mime = (file as File & { type?: string }).type || "";
  if (!allowed.includes(mime)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const bytes = await (file as File).arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = `${Date.now()}-${(file as File).name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filepath, buffer);

  return NextResponse.json({ url: `/uploads/${filename}` });
}
