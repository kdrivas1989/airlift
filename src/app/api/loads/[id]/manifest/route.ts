import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { runAllChecks, checkLoadEditable, getLoadStats } from "@/lib/safety";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const loadId = Number(id);
    const body = await request.json();
    const { jumperId, jumpType, altitude } = body;

    if (!jumperId || !jumpType) {
      return NextResponse.json({ error: "Jumper and jump type required" }, { status: 400 });
    }

    const db = getDb();

    // Check load is editable
    const editable = checkLoadEditable(db, loadId);
    if (!editable.ok) return NextResponse.json({ error: editable.error }, { status: 400 });

    // Run all safety checks
    const safety = runAllChecks(db, loadId, jumperId, jumpType);
    if (!safety.ok) {
      const status = safety.error?.includes("already manifested") ? 409 : 400;
      return NextResponse.json({ error: safety.error }, { status });
    }

    // Get next exit order
    const maxOrder = db.prepare(
      "SELECT COALESCE(MAX(exit_order), 0) as max_order FROM manifest_entries WHERE load_id = ?"
    ).get(loadId) as { max_order: number };

    // Get ticket price
    const load = db.prepare("SELECT default_altitude FROM loads WHERE id = ?").get(loadId) as { default_altitude: number };
    const pricing = db.prepare(
      "SELECT price FROM jump_type_pricing WHERE jump_type = ? AND active = 1"
    ).get(jumpType) as { price: number } | undefined;

    const ticketPrice = pricing?.price || 0;

    const result = db.prepare(`
      INSERT INTO manifest_entries (load_id, jumper_id, jump_type, altitude, exit_order, ticket_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(loadId, jumperId, jumpType, altitude || load.default_altitude, maxOrder.max_order + 1, ticketPrice);

    // Deduct jump block if jumper has blocks remaining
    if (ticketPrice > 0) {
      const jumperBalance = db.prepare("SELECT jump_block_remaining, balance FROM jumpers WHERE id = ?").get(jumperId) as { jump_block_remaining: number; balance: number };
      if (jumperBalance.jump_block_remaining > 0) {
        db.prepare("UPDATE jumpers SET jump_block_remaining = jump_block_remaining - 1 WHERE id = ?").run(jumperId);
        db.prepare(
          "INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)"
        ).run(jumperId, -1, "block_debit", `Load #${loadId} - ${jumpType}`);
      } else if (jumperBalance.balance >= ticketPrice) {
        db.prepare("UPDATE jumpers SET balance = balance - ? WHERE id = ?").run(ticketPrice, jumperId);
        db.prepare(
          "INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)"
        ).run(jumperId, -ticketPrice, "debit", `Load #${loadId} - ${jumpType}`);
      }
    }

    const entry = db.prepare("SELECT * FROM manifest_entries WHERE id = ?").get(result.lastInsertRowid);
    const stats = getLoadStats(db, loadId);

    return NextResponse.json({ entry, loadWeight: stats.currentWeight, slotsRemaining: stats.slotsRemaining }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const loadId = Number(id);
    const body = await request.json();
    const { jumperId } = body;

    const db = getDb();

    const editable = checkLoadEditable(db, loadId);
    if (!editable.ok) return NextResponse.json({ error: editable.error }, { status: 400 });

    const entry = db.prepare(
      "SELECT * FROM manifest_entries WHERE load_id = ? AND jumper_id = ?"
    ).get(loadId, jumperId);

    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    // Refund block or balance
    const removedEntry = entry as { ticket_price: number; jump_type: string };
    if (removedEntry.ticket_price > 0) {
      // Check if a block was deducted (look for recent block_debit)
      const blockDebit = db.prepare(
        "SELECT id FROM balance_transactions WHERE jumper_id = ? AND type = 'block_debit' AND description LIKE ? ORDER BY created_at DESC LIMIT 1"
      ).get(jumperId, `Load #${loadId}%`) as { id: number } | undefined;
      if (blockDebit) {
        db.prepare("UPDATE jumpers SET jump_block_remaining = jump_block_remaining + 1 WHERE id = ?").run(jumperId);
        db.prepare("DELETE FROM balance_transactions WHERE id = ?").run(blockDebit.id);
      } else {
        const cashDebit = db.prepare(
          "SELECT id, amount FROM balance_transactions WHERE jumper_id = ? AND type = 'debit' AND description LIKE ? ORDER BY created_at DESC LIMIT 1"
        ).get(jumperId, `Load #${loadId}%`) as { id: number; amount: number } | undefined;
        if (cashDebit) {
          db.prepare("UPDATE jumpers SET balance = balance + ? WHERE id = ?").run(Math.abs(cashDebit.amount), jumperId);
          db.prepare("DELETE FROM balance_transactions WHERE id = ?").run(cashDebit.id);
        }
      }
    }

    db.prepare("DELETE FROM manifest_entries WHERE load_id = ? AND jumper_id = ?").run(loadId, jumperId);

    // Re-number exit orders
    const remaining = db.prepare(
      "SELECT id FROM manifest_entries WHERE load_id = ? ORDER BY exit_order"
    ).all(loadId) as Array<{ id: number }>;

    const updateOrder = db.prepare("UPDATE manifest_entries SET exit_order = ? WHERE id = ?");
    remaining.forEach((r, i) => updateOrder.run(i + 1, r.id));

    const stats = getLoadStats(db, loadId);
    return NextResponse.json({ ok: true, loadWeight: stats.currentWeight, slotsRemaining: stats.slotsRemaining });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
