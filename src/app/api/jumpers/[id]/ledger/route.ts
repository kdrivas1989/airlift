import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const db = getDb();

    const jumper = db.prepare(
      "SELECT id, first_name, last_name, email, balance, jump_block_remaining FROM jumpers WHERE id = ?"
    ).get(id) as Record<string, unknown> | undefined;

    if (!jumper) return NextResponse.json({ error: "Jumper not found" }, { status: 404 });

    // All balance transactions
    const transactions = db.prepare(`
      SELECT * FROM balance_transactions WHERE jumper_id = ? ORDER BY created_at DESC
    `).all(id) as Array<Record<string, unknown>>;

    // All manifest entries with load info
    const jumps = db.prepare(`
      SELECT me.id, me.jump_type, me.altitude, me.ticket_price, me.payment_method, me.created_at,
        l.load_number, l.status, l.created_at as load_date,
        COALESCE(a.name, a.tail_number) as aircraft_name
      FROM manifest_entries me
      JOIN loads l ON l.id = me.load_id
      JOIN aircraft a ON a.id = l.aircraft_id
      WHERE me.jumper_id = ?
      ORDER BY me.created_at DESC
    `).all(id) as Array<Record<string, unknown>>;

    // Build combined ledger sorted by date
    const ledger: Array<{
      date: string;
      type: "jump" | "credit" | "debit" | "block_credit" | "block_debit";
      description: string;
      amount: number | null;
      blocks: number | null;
      loadNumber: number | null;
      paymentMethod: string | null;
    }> = [];

    for (const t of transactions) {
      ledger.push({
        date: t.created_at as string,
        type: t.type as "credit" | "debit" | "block_credit" | "block_debit",
        description: t.description as string,
        amount: ["credit", "debit"].includes(t.type as string) ? (t.amount as number) : null,
        blocks: ["block_credit", "block_debit"].includes(t.type as string) ? (t.amount as number) : null,
        loadNumber: null,
        paymentMethod: null,
      });
    }

    for (const j of jumps) {
      ledger.push({
        date: j.created_at as string,
        type: "jump",
        description: `Load #${j.load_number} — ${j.jump_type} @ ${((j.altitude as number) / 1000).toFixed(1)}k (${j.aircraft_name})`,
        amount: j.payment_method === "cash" ? -(j.ticket_price as number) : null,
        blocks: j.payment_method === "block" ? -1 : null,
        loadNumber: j.load_number as number,
        paymentMethod: (j.payment_method as string) || "block",
      });
    }

    // Sort newest first
    ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      jumper: {
        id: jumper.id,
        firstName: jumper.first_name,
        lastName: jumper.last_name,
        balance: jumper.balance,
        jumpBlockRemaining: jumper.jump_block_remaining,
      },
      ledger,
      totalJumps: jumps.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
