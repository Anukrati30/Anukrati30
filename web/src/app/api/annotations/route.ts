import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "annotations.json");

async function ensureFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, JSON.stringify({ byDataset: {} }, null, 2), "utf-8");
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const datasetId = searchParams.get("datasetId");
  await ensureFile();
  const raw = await fs.readFile(FILE, "utf-8");
  type DB = { byDataset: Record<string, unknown[]> };
  const db = JSON.parse(raw) as DB;
  const items = datasetId ? db.byDataset[datasetId] ?? [] : db.byDataset;
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { datasetId, annotation } = body ?? {};
  if (!datasetId || !annotation) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  await ensureFile();
  const raw = await fs.readFile(FILE, "utf-8");
  const db = JSON.parse(raw) as { byDataset: Record<string, unknown[]> };
  db.byDataset[datasetId] = db.byDataset[datasetId] ?? [];
  db.byDataset[datasetId].push(annotation);
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { datasetId, annotation } = body ?? {};
  if (!datasetId || !annotation || !annotation.id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  await ensureFile();
  const raw = await fs.readFile(FILE, "utf-8");
  type Ann = { id?: string } & Record<string, unknown>;
  const db = JSON.parse(raw) as { byDataset: Record<string, Ann[]> };
  const arr: Ann[] = db.byDataset[datasetId] ?? [];
  const idx = arr.findIndex((a) => a.id === annotation.id);
  if (idx >= 0) arr[idx] = annotation; else arr.push(annotation);
  db.byDataset[datasetId] = arr;
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const datasetId = searchParams.get("datasetId");
  const body = await req.json().catch(() => ({}));
  const id = body?.id;
  if (!datasetId || !id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  await ensureFile();
  const raw = await fs.readFile(FILE, "utf-8");
  const db = JSON.parse(raw) as { byDataset: Record<string, { id?: string }[]> };
  const arr = db.byDataset[datasetId] ?? [];
  db.byDataset[datasetId] = arr.filter((a) => a.id !== id);
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}
