import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/uspa/cookies — receive cookies from bookmarklet.
 * Protected by a simple token stored in settings.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cookies, token } = body;

    if (!cookies || !token) {
      return NextResponse.json({ error: "Missing cookies or token" }, { status: 400 });
    }

    const db = getDb();
    const stored = db.prepare("SELECT value FROM settings WHERE key = 'uspa_sync_token'").get() as { value: string } | undefined;
    if (!stored || stored.value !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Save the cookies
    db.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES ('uspa_cookies', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
    ).run(cookies);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/uspa/cookies — generate a new sync token.
 */
export async function GET() {
  try {
    const db = getDb();
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    db.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES ('uspa_sync_token', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
    ).run(token);
    return NextResponse.json({ token });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
