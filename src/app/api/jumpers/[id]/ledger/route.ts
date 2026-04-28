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

    // Instructor tandem data: students paired with this instructor
    const tandemStudents = db.prepare(`
      SELECT me.id, me.created_at, me.ticket_price,
        l.load_number,
        j.first_name as student_first, j.last_name as student_last
      FROM manifest_entries me
      JOIN loads l ON l.id = me.load_id
      JOIN jumpers j ON j.id = me.jumper_id
      WHERE me.paired_with = ?
      ORDER BY me.created_at DESC
    `).all(id) as Array<Record<string, unknown>>;

    // Build combined ledger sorted by date
    interface LedgerEntry {
      date: string;
      type: string;
      description: string;
      amount: number | null;
      blocks: number | null;
      loadNumber: number | null;
      paymentMethod: string | null;
      studentName: string | null;
      instructorEarnings: number | null;
    }
    const ledger: LedgerEntry[] = [];

    for (const t of transactions) {
      ledger.push({
        date: t.created_at as string,
        type: t.type as string,
        description: t.description as string,
        amount: ["credit", "debit", "cc_fee"].includes(t.type as string) ? (t.amount as number) : null,
        blocks: ["block_credit", "block_debit"].includes(t.type as string) ? (t.amount as number) : null,
        loadNumber: null,
        paymentMethod: null,
        studentName: null,
        instructorEarnings: null,
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
        studentName: null,
        instructorEarnings: null,
      });
    }

    // Instructor earnings entries
    const isStaff = ((jumper as Record<string, unknown>).person_type as string || "").includes("staff");
    let totalEarnings = 0;
    if (isStaff) {
      for (const ts of tandemStudents) {
        // TODO: make instructor rate configurable; default $50 per tandem
        const earnings = 5000; // $50.00 in cents
        totalEarnings += earnings;
        ledger.push({
          date: ts.created_at as string,
          type: "instructor_earning",
          description: `Tandem — Load #${ts.load_number}`,
          amount: earnings,
          blocks: null,
          loadNumber: ts.load_number as number,
          paymentMethod: null,
          studentName: `${ts.student_first} ${ts.student_last}`,
          instructorEarnings: earnings,
        });
      }
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
      totalTandems: tandemStudents.length,
      totalEarnings,
      isStaff,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
