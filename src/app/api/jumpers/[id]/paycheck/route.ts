import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/jumpers/[id]/paycheck — issue paycheck, zeroes out instructor earnings.
 * Records the payout as a balance transaction.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { id } = await params;
    const db = getDb();

    const jumper = db.prepare("SELECT * FROM jumpers WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!jumper) return NextResponse.json({ error: "Jumper not found" }, { status: 404 });

    // Calculate unpaid instructor earnings: count tandems where this person was paired_with
    // that haven't been paid out yet
    const lastPayout = db.prepare(
      "SELECT created_at FROM balance_transactions WHERE jumper_id = ? AND type = 'paycheck' ORDER BY created_at DESC LIMIT 1"
    ).get(id) as { created_at: string } | undefined;

    let tandemQuery = `
      SELECT COUNT(*) as count FROM manifest_entries me
      JOIN loads l ON l.id = me.load_id
      WHERE me.paired_with = ?
    `;
    const tandemParams: unknown[] = [id];

    if (lastPayout) {
      tandemQuery += " AND me.created_at > ?";
      tandemParams.push(lastPayout.created_at);
    }

    const tandemCount = db.prepare(tandemQuery).get(...tandemParams) as { count: number };

    // $50 per tandem (in cents)
    const earningsPerTandem = 5000;
    const totalEarnings = tandemCount.count * earningsPerTandem;

    if (totalEarnings === 0) {
      return NextResponse.json({ error: "No unpaid earnings to pay out" }, { status: 400 });
    }

    // Record the paycheck
    db.prepare(
      "INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)"
    ).run(id, -totalEarnings, "paycheck", `Paycheck: ${tandemCount.count} tandem(s) @ $${(earningsPerTandem / 100).toFixed(2)} = $${(totalEarnings / 100).toFixed(2)}`);

    return NextResponse.json({
      tandems: tandemCount.count,
      totalEarnings,
      paid: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
