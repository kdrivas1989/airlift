import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkWeight, checkSlots, checkLoadEditable, checkDoubleBooking } from "@/lib/safety";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { loadId } = await request.json();
  if (!loadId) return NextResponse.json({ error: "loadId required" }, { status: 400 });

  const db = getDb();

  const entry = db.prepare("SELECT * FROM tandem_reception WHERE id = ?").get(Number(id)) as Record<string, unknown> | undefined;
  if (!entry) return NextResponse.json({ error: "Reception entry not found" }, { status: 404 });

  if (entry.status !== "paired") {
    return NextResponse.json({ error: "Must be paired with an instructor before manifesting" }, { status: 400 });
  }

  const jumperId = entry.jumper_id as number;
  const instructorId = entry.instructor_id as number;
  const videographerId = entry.videographer_id as number | null;
  const hasOutsideVideo = !!videographerId;

  const editable = checkLoadEditable(db, loadId);
  if (!editable.ok) return NextResponse.json({ error: editable.error }, { status: 400 });

  const slotCheck = checkSlots(db, loadId);
  if (!slotCheck.ok) return NextResponse.json({ error: slotCheck.error }, { status: 400 });

  // Weight check: passenger + instructor + videographer if applicable
  const passenger = db.prepare("SELECT weight FROM jumpers WHERE id = ?").get(jumperId) as { weight: number };
  const instructor = db.prepare("SELECT weight FROM jumpers WHERE id = ?").get(instructorId) as { weight: number };
  let totalWeight = passenger.weight + instructor.weight;
  if (hasOutsideVideo) {
    const videographer = db.prepare("SELECT weight FROM jumpers WHERE id = ?").get(videographerId) as { weight: number };
    totalWeight += videographer.weight;
  }
  const weightCheck = checkWeight(db, loadId, totalWeight);
  if (!weightCheck.ok) return NextResponse.json({ error: weightCheck.error }, { status: 400 });

  const passengerDouble = checkDoubleBooking(db, jumperId, loadId);
  if (!passengerDouble.ok) return NextResponse.json({ error: `Passenger: ${passengerDouble.error}` }, { status: 400 });

  const maxOrder = db.prepare("SELECT COALESCE(MAX(exit_order), 0) as max_order FROM manifest_entries WHERE load_id = ?").get(loadId) as { max_order: number };
  let nextOrder = maxOrder.max_order + 1;

  const tandemPrice = db.prepare("SELECT price FROM jump_type_pricing WHERE jump_type = 'tandem'").get() as { price: number } | undefined;

  // Add tandem entry (student + instructor = 2 slots via paired_with)
  db.prepare(
    "INSERT INTO manifest_entries (load_id, jumper_id, jump_type, altitude, exit_order, ticket_price, paired_with) VALUES (?, ?, 'tandem', 14000, ?, ?, ?)"
  ).run(loadId, jumperId, nextOrder, tandemPrice?.price || 0, instructorId);

  // Add videographer as separate manifest entry (3rd slot)
  if (hasOutsideVideo) {
    nextOrder++;
    db.prepare(
      "INSERT INTO manifest_entries (load_id, jumper_id, jump_type, altitude, exit_order, ticket_price) VALUES (?, ?, 'video', 14000, ?, 0)"
    ).run(loadId, videographerId, nextOrder);
  }

  db.prepare(
    "UPDATE tandem_reception SET status = 'manifested', load_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(loadId, Number(id));

  return NextResponse.json({ success: true, loadId });
}
