import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion,
});

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const { amount, jumperId, description } = await request.json();

    if (!amount || amount < 50) {
      return NextResponse.json({ error: "Minimum charge is $0.50" }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount, // in cents
      currency: "usd",
      metadata: {
        source: "airlift",
        jumperId: String(jumperId),
        description: description || "AirLIFT payment",
      },
      statement_descriptor_suffix: "ALTER EGO ADV",
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
