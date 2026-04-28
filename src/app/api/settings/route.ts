import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('dz_lat', 'dz_lng', 'dz_name')").all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const stmt = db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at");

  for (const [key, value] of Object.entries(body)) {
    if (["dz_lat", "dz_lng", "dz_name"].includes(key)) {
      stmt.run(key, String(value));
    }
  }
  return NextResponse.json({ ok: true });
}
