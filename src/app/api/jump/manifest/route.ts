import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { runAllChecks, checkLoadEditable, getLoadStats } from "@/lib/safety";

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { loadId, jumpType } = await request.json();
  if (!loadId || !jumpType) return NextResponse.json({ error: "loadId and jumpType required" }, { status: 400 });

  const db = getDb();
  const jumperId = user.staffId;

  // Block students from self-manifesting
  const jumper = db.prepare("SELECT person_type, license_level FROM jumpers WHERE id = ?").get(jumperId) as { person_type: string; license_level: string } | undefined;
  if (!jumper) return NextResponse.json({ error: "Jumper not found" }, { status: 404 });
  const isStudent = (jumper.person_type || "").includes("student") || jumper.license_level === "student";
  if (isStudent) return NextResponse.json({ error: "Students must be manifested by staff" }, { status: 403 });

  // Check load is editable
  const editable = checkLoadEditable(db, loadId);
  if (!editable.ok) return NextResponse.json({ error: editable.error }, { status: 400 });

  // Run safety checks
  const safety = runAllChecks(db, loadId, jumperId, jumpType);
  if (!safety.ok) return NextResponse.json({ error: safety.error }, { status: 400 });

  // Get next exit order
  const maxOrder = db.prepare(
    "SELECT COALESCE(MAX(exit_order), 0) as max_order FROM manifest_entries WHERE load_id = ?"
  ).get(loadId) as { max_order: number };

  // Get ticket price
  const load = db.prepare("SELECT default_altitude, load_number FROM loads WHERE id = ?").get(loadId) as { default_altitude: number; load_number: number };
  const pricing = db.prepare(
    "SELECT price FROM jump_type_pricing WHERE jump_type = ? AND active = 1"
  ).get(jumpType) as { price: number } | undefined;
  const ticketPrice = pricing?.price || 0;

  db.prepare(
    "INSERT INTO manifest_entries (load_id, jumper_id, jump_type, altitude, exit_order, ticket_price) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(loadId, jumperId, jumpType, load.default_altitude, maxOrder.max_order + 1, ticketPrice);

  // Deduct jump block or cash
  if (ticketPrice > 0) {
    const jumper = db.prepare("SELECT jump_block_remaining, balance FROM jumpers WHERE id = ?").get(jumperId) as { jump_block_remaining: number; balance: number };
    if (jumper.jump_block_remaining > 0) {
      db.prepare("UPDATE jumpers SET jump_block_remaining = jump_block_remaining - 1 WHERE id = ?").run(jumperId);
      db.prepare(
        "INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)"
      ).run(jumperId, -1, "block_debit", `Self-manifest Load #${load.load_number} - ${jumpType}`);
    } else if (jumper.balance >= ticketPrice) {
      db.prepare("UPDATE jumpers SET balance = balance - ? WHERE id = ?").run(ticketPrice, jumperId);
      db.prepare(
        "INSERT INTO balance_transactions (jumper_id, amount, type, description) VALUES (?, ?, ?, ?)"
      ).run(jumperId, -ticketPrice, "debit", `Self-manifest Load #${load.load_number} - ${jumpType}`);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { loadId } = await request.json();
  if (!loadId) return NextResponse.json({ error: "loadId required" }, { status: 400 });

  const db = getDb();
  const jumperId = user.staffId;

  const editable = checkLoadEditable(db, loadId);
  if (!editable.ok) return NextResponse.json({ error: editable.error }, { status: 400 });

  // Block self-removal within 10 minutes of departure
  const load = db.prepare("SELECT departure_time FROM loads WHERE id = ?").get(loadId) as { departure_time: string | null } | undefined;
  if (load?.departure_time) {
    const minsUntilDep = (new Date(load.departure_time).getTime() - Date.now()) / 60000;
    if (minsUntilDep <= 10) {
      return NextResponse.json({ error: "Cannot leave load within 10 minutes of departure. See manifest staff." }, { status: 400 });
    }
  }

  const entry = db.prepare(
    "SELECT * FROM manifest_entries WHERE load_id = ? AND jumper_id = ?"
  ).get(loadId, jumperId) as { ticket_price: number } | undefined;
  if (!entry) return NextResponse.json({ error: "Not on this load" }, { status: 404 });

  const loadInfo = db.prepare("SELECT load_number FROM loads WHERE id = ?").get(loadId) as { load_number: number };

  // Refund block or cash
  if (entry.ticket_price > 0) {
    const blockDebit = db.prepare(
      "SELECT id FROM balance_transactions WHERE jumper_id = ? AND type = 'block_debit' AND description LIKE ? ORDER BY created_at DESC LIMIT 1"
    ).get(jumperId, `%Load #${loadInfo.load_number}%`) as { id: number } | undefined;
    if (blockDebit) {
      db.prepare("UPDATE jumpers SET jump_block_remaining = jump_block_remaining + 1 WHERE id = ?").run(jumperId);
      db.prepare("DELETE FROM balance_transactions WHERE id = ?").run(blockDebit.id);
    } else {
      const cashDebit = db.prepare(
        "SELECT id, amount FROM balance_transactions WHERE jumper_id = ? AND type = 'debit' AND description LIKE ? ORDER BY created_at DESC LIMIT 1"
      ).get(jumperId, `%Load #${loadInfo.load_number}%`) as { id: number; amount: number } | undefined;
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

  return NextResponse.json({ success: true });
}
