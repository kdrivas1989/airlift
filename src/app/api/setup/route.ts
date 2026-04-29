import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/setup — 2-step account setup with email verification.
 *
 * Step 1: { email }            → sends 6-digit code to the email
 * Step 2: { email, code, password } → verifies code, sets password
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitError = checkRateLimit(request);
    if (rateLimitError) {
      return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    const body = await request.json();
    const { email, code, password } = body;

    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const db = getDb();
    const jumper = db.prepare("SELECT id, first_name, last_name FROM jumpers WHERE email = ?").get(email) as
      { id: number; first_name: string; last_name: string } | undefined;

    // --- Step 2: verify code and set password ---
    if (code && password) {
      if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      if (!jumper) return NextResponse.json({ error: "No account found with that email." }, { status: 404 });

      const settingKey = `setup_code_${email.toLowerCase()}`;
      const setting = db.prepare("SELECT value FROM settings WHERE key = ?").get(settingKey) as { value: string } | undefined;
      if (!setting) return NextResponse.json({ error: "No verification code found. Request a new one." }, { status: 400 });

      const { code: storedCode, expires } = JSON.parse(setting.value);
      if (new Date(expires) < new Date()) {
        db.prepare("DELETE FROM settings WHERE key = ?").run(settingKey);
        return NextResponse.json({ error: "Verification code expired. Request a new one." }, { status: 400 });
      }
      if (storedCode !== code.trim()) {
        return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
      }

      // Code is valid — set password and clean up
      const hash = hashPassword(password);
      db.prepare("UPDATE jumpers SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, jumper.id);
      db.prepare("DELETE FROM settings WHERE key = ?").run(settingKey);

      return NextResponse.json({ success: true });
    }

    // --- Step 1: send verification code ---
    if (!jumper) {
      return NextResponse.json({ error: "No account found with that email. Check your booking confirmation for the email you used." }, { status: 404 });
    }

    // Generate 6-digit code
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const settingKey = `setup_code_${email.toLowerCase()}`;
    db.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
    ).run(settingKey, JSON.stringify({ code: verificationCode, expires }));

    await sendEmail(
      email,
      `${jumper.first_name} ${jumper.last_name}`,
      "Your AirLIFT verification code",
      `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
        <h2 style="color:#1a1a2e">Account Setup</h2>
        <p>Hi ${jumper.first_name},</p>
        <p>Your verification code is:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center;color:#2563eb;margin:24px 0">${verificationCode}</p>
        <p style="color:#666;font-size:13px">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>`
    );

    return NextResponse.json({ codeSent: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
