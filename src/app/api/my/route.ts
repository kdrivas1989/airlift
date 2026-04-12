import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();
    const db = getDb();

    // Get jumper record
    const jumper = db.prepare(
      "SELECT id, balance, jump_block_remaining FROM jumpers WHERE id = ?"
    ).get(user.staffId) as { id: number; balance: number; jump_block_remaining: number } | undefined;

    // Current loads (open, boarding, in_flight)
    const currentLoads = db.prepare(`
      SELECT me.load_id as loadId, l.load_number as loadNumber, me.jump_type as jumpType,
        me.altitude, l.status, l.created_at as date, l.departure_time as departureTime,
        COALESCE(a.name, a.tail_number) as aircraftName
      FROM manifest_entries me
      JOIN loads l ON l.id = me.load_id
      JOIN aircraft a ON a.id = l.aircraft_id
      WHERE me.jumper_id = ? AND l.status IN ('open', 'boarding', 'in_flight')
      ORDER BY l.created_at DESC
    `).all(user.staffId);

    // Jump history (landed, closed)
    const jumpHistory = db.prepare(`
      SELECT me.load_id as loadId, l.load_number as loadNumber, me.jump_type as jumpType,
        me.altitude, l.status, l.created_at as date, l.departure_time as departureTime,
        COALESCE(a.name, a.tail_number) as aircraftName
      FROM manifest_entries me
      JOIN loads l ON l.id = me.load_id
      JOIN aircraft a ON a.id = l.aircraft_id
      WHERE me.jumper_id = ? AND l.status IN ('landed', 'closed')
      ORDER BY l.created_at DESC
      LIMIT 50
    `).all(user.staffId);

    return NextResponse.json({
      currentLoads,
      jumpHistory,
      balance: jumper ? { balance: jumper.balance, jumpBlockRemaining: jumper.jump_block_remaining } : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
