import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();
    if (!token || !password) return NextResponse.json({ error: "Token and password required" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(`reset_${token}`) as { value: string } | undefined;
    if (!row) return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });

    const data = JSON.parse(row.value);
    if (new Date(data.expires) < new Date()) {
      db.prepare("DELETE FROM settings WHERE key = ?").run(`reset_${token}`);
      return NextResponse.json({ error: "Link has expired. Request a new one." }, { status: 400 });
    }

    const hash = hashPassword(password);
    db.prepare("UPDATE jumpers SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, data.jumperId);

    // Clean up token
    db.prepare("DELETE FROM settings WHERE key = ?").run(`reset_${token}`);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
