import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const rateLimitError = checkRateLimit(request);
    if (rateLimitError) {
      return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const db = getDb();

    // Clean up expired reset tokens
    const allResetKeys = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'reset_%'").all() as Array<{ key: string; value: string }>;
    const now = new Date();
    for (const row of allResetKeys) {
      try {
        const parsed = JSON.parse(row.value);
        if (parsed.expires && new Date(parsed.expires) < now) {
          db.prepare("DELETE FROM settings WHERE key = ?").run(row.key);
        }
      } catch {
        // Malformed entry — delete it
        db.prepare("DELETE FROM settings WHERE key = ?").run(row.key);
      }
    }

    const jumper = db.prepare("SELECT id, first_name, last_name FROM jumpers WHERE email = ?").get(email) as { id: number; first_name: string; last_name: string } | undefined;

    // Always return success to prevent email enumeration
    if (!jumper) return NextResponse.json({ sent: true });

    // Generate reset token (valid 1 hour)
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    db.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
    ).run(`reset_${token}`, JSON.stringify({ jumperId: jumper.id, expires }));

    const origin = request.headers.get("origin") || "https://airlift.kd-evolution.com";
    const resetUrl = `${origin}/reset-password?token=${token}`;

    await sendEmail(
      email,
      `${jumper.first_name} ${jumper.last_name}`,
      "Reset your AirLIFT password",
      `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
        <h2 style="color:#1a1a2e">Reset Your Password</h2>
        <p>Hi ${jumper.first_name},</p>
        <p>Click the button below to set your AirLIFT password:</p>
        <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
          Set Password
        </a>
        <p style="color:#666;font-size:13px">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>`
    );

    return NextResponse.json({ sent: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
