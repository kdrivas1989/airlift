import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

/**
 * POST /api/setup — let a jumper set their password by email.
 * Works for accounts created via booking (have random password).
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    const db = getDb();
    const jumper = db.prepare("SELECT id FROM jumpers WHERE email = ?").get(email) as { id: number } | undefined;
    if (!jumper) {
      return NextResponse.json({ error: "No account found with that email. Check your booking confirmation for the email you used." }, { status: 404 });
    }

    const hash = hashPassword(password);
    db.prepare("UPDATE jumpers SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, jumper.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
