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
      "SELECT id, balance, jump_block_remaining FROM jumpers WHERE id = ?"
    ).get(id) as { id: number; balance: number; jump_block_remaining: number } | undefined;

    if (!jumper) return NextResponse.json({ error: "Jumper not found" }, { status: 404 });

    const transactions = db.prepare(
      "SELECT * FROM balance_transactions WHERE jumper_id = ? ORDER BY created_at DESC LIMIT 50"
    ).all(id);

    return NextResponse.json({ balance: jumper.balance, jumpBlockRemaining: jumper.jump_block_remaining, transactions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const db = getDb();
    const body = await request.json();
    const { type, amount, description } = body;

    // type: "add_cash" | "add_blocks" | "deduct_cash" | "deduct_block"
    if (!type || amount === undefined) {
      return NextResponse.json({ error: "Type and amount required" }, { status: 400 });
    }

    const jumper = db.prepare("SELECT * FROM jumpers WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!jumper) return NextResponse.json({ error: "Jumper not found" }, { status: 404 });

    if (type === "add_cash") {
      const cents = Math.round(amount * 100);
      db.prepare("UPDATE jumpers SET balance = balance + ? WHERE id = ?").run(cents, id);
      db.prepare("INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)").run(id, cents, "credit", description || `Added $${amount.toFixed(2)}`);
    } else if (type === "add_blocks") {
      const blocks = Math.round(amount);
      db.prepare("UPDATE jumpers SET jump_block_remaining = jump_block_remaining + ? WHERE id = ?").run(blocks, id);
      db.prepare("INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)").run(id, blocks, "block_credit", description || `Added ${blocks} jump block(s)`);
    } else if (type === "deduct_cash") {
      const cents = Math.round(amount * 100);
      db.prepare("UPDATE jumpers SET balance = balance - ? WHERE id = ?").run(cents, id);
      db.prepare("INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)").run(id, -cents, "debit", description || `Deducted $${amount.toFixed(2)}`);
    } else if (type === "deduct_block") {
      if ((jumper.jump_block_remaining as number) < 1) {
        return NextResponse.json({ error: "No jump blocks remaining" }, { status: 400 });
      }
      db.prepare("UPDATE jumpers SET jump_block_remaining = jump_block_remaining - 1 WHERE id = ?").run(id);
      db.prepare("INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)").run(id, -1, "block_debit", description || "Used 1 jump block");
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const updated = db.prepare("SELECT balance, jump_block_remaining FROM jumpers WHERE id = ?").get(id) as { balance: number; jump_block_remaining: number };
    return NextResponse.json({ balance: updated.balance, jumpBlockRemaining: updated.jump_block_remaining });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
