import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const { amount, jumperId, description } = await request.json();

    if (!amount || amount < 50) {
      return NextResponse.json({ error: "Minimum charge is $0.50" }, { status: 400 });
    }

    const db = getDb();
    let jumperName = "Unknown";
    if (jumperId) {
      const j = db.prepare("SELECT first_name, last_name FROM jumpers WHERE id = ?").get(jumperId) as { first_name: string; last_name: string } | undefined;
      if (j) jumperName = `${j.first_name} ${j.last_name}`;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      metadata: {
        source: "airlift_terminal",
        jumperId: String(jumperId || ""),
        jumperName,
        description: description || "AirLIFT Tap to Pay",
      },
      statement_descriptor_suffix: "ALTER EGO ADV",
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
