import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

/**
 * POST /api/terminal/capture — called after successful tap-to-pay.
 * Credits the jumper's account with the base amount (minus 3% CC fee).
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const { paymentIntentId, jumperId, baseAmount } = await request.json();

    // Verify the payment succeeded
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") {
      return NextResponse.json({ error: `Payment status: ${pi.status}` }, { status: 400 });
    }

    if (!jumperId || !baseAmount) {
      return NextResponse.json({ success: true, credited: false });
    }

    const db = getDb();
    const cents = Math.round(baseAmount);

    // Credit base amount to jumper
    db.prepare("UPDATE jumpers SET balance = balance + ? WHERE id = ?").run(cents, jumperId);
    db.prepare(
      "INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)"
    ).run(jumperId, cents, "credit", `Tap to Pay $${(cents / 100).toFixed(2)}`);

    // Log CC fee
    const feeCents = pi.amount - cents;
    if (feeCents > 0) {
      db.prepare(
        "INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)"
      ).run(jumperId, -feeCents, "cc_fee", `3% CC fee on $${(cents / 100).toFixed(2)}`);
    }

    return NextResponse.json({ success: true, credited: true, balance: cents });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
