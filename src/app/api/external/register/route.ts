import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

/**
 * External registration endpoint for Alter Ego Adventures integration.
 * Called by the booking system's Stripe webhook after successful payment.
 * Creates or updates a jumper account and assigns jump blocks/balance.
 *
 * Auth: Bearer token (AIRLIFT_API_KEY env var)
 */
export async function POST(request: NextRequest) {
  try {
  // Verify API key
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.AIRLIFT_API_KEY;
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    firstName,
    lastName,
    email,
    phone,
    bookingRef,
    jumpBlocks,       // number of jump tickets (10, 20, etc.)
    tandemJumps,      // number of tandem jumps purchased
    balanceAmount,     // cash balance to add in dollars (optional)
  } = body;

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: "firstName, lastName, and email required" }, { status: 400 });
  }

  const db = getDb();

  // Check if jumper already exists by email
  let jumper = db.prepare("SELECT * FROM jumpers WHERE email = ?").get(email) as Record<string, unknown> | undefined;
  let generatedPassword: string | undefined;

  if (!jumper) {
    // Create new jumper account — pre-approved for manifesting (boogie registration)
    const now = new Date().toISOString();
    const reserveDate = now.split("T")[0]; // today, valid for 180 days
    // Generate a random password for the jumper's login
    generatedPassword = Math.random().toString(36).slice(2, 10); // 8 char alphanumeric
    const pwHash = hashPassword(generatedPassword);

    const result = db.prepare(`
      INSERT INTO jumpers (first_name, last_name, email, phone, date_of_birth, weight, license_level, balance, jump_block_remaining,
        uspa_number, uspa_status, uspa_verified_at, reserve_pack_date, password_hash)
      VALUES (?, ?, ?, ?, '1990-01-01', 180, 'unknown', 0, 0,
        'BOOGIE', 'Active', ?, ?, ?)
    `).run(firstName, lastName, email, phone || null, now, reserveDate, pwHash);

    const newId = result.lastInsertRowid;
    jumper = db.prepare("SELECT * FROM jumpers WHERE id = ?").get(newId) as Record<string, unknown>;

    // Auto-create waiver so jumper passes compliance checks
    db.prepare(
      "INSERT INTO waivers (jumper_id, signature_data, initials) VALUES (?, ?, ?)"
    ).run(newId, "boogie-registration", firstName.charAt(0) + lastName.charAt(0));
  }

  const jumperId = jumper.id as number;
  const addedBlocks = (jumpBlocks || 0) + (tandemJumps || 0);
  const addedCash = Math.round((balanceAmount || 0) * 100);

  // Add jump blocks
  if (addedBlocks > 0) {
    db.prepare("UPDATE jumpers SET jump_block_remaining = jump_block_remaining + ? WHERE id = ?").run(addedBlocks, jumperId);
    db.prepare(
      "INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)"
    ).run(jumperId, addedBlocks, "block_credit", `Alter Ego booking ${bookingRef || ""}: ${addedBlocks} jump(s)`);
  }

  // Add cash balance
  if (addedCash > 0) {
    db.prepare("UPDATE jumpers SET balance = balance + ? WHERE id = ?").run(addedCash, jumperId);
    db.prepare(
      "INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)"
    ).run(jumperId, addedCash, "credit", `Alter Ego booking ${bookingRef || ""}: $${balanceAmount.toFixed(2)}`);
  }

  // Fetch updated state
  const updated = db.prepare(
    "SELECT id, first_name, last_name, email, balance, jump_block_remaining FROM jumpers WHERE id = ?"
  ).get(jumperId) as Record<string, unknown>;

  return NextResponse.json({
    jumperId: updated.id,
    firstName: updated.first_name,
    lastName: updated.last_name,
    email: updated.email,
    balance: updated.balance,
    jumpBlockRemaining: updated.jump_block_remaining,
    created: !jumper,
    ...(generatedPassword ? { temporaryPassword: generatedPassword } : {}),
  }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : "";
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}
