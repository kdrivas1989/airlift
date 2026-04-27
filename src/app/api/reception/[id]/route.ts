import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  const entry = db.prepare("SELECT * FROM tandem_reception WHERE id = ?").get(Number(id)) as Record<string, unknown> | undefined;
  if (!entry) return NextResponse.json({ error: "Reception entry not found" }, { status: 404 });

  if (body.status) {
    const validTransitions: Record<string, string[]> = {
      booked: ["checked_in", "cancelled"],
      checked_in: ["standby", "cancelled"],
      standby: ["paired", "cancelled"],
      paired: ["manifested", "standby", "cancelled"],
      manifested: ["paired", "cancelled"],
    };
    const allowed = validTransitions[entry.status as string] || [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: `Cannot transition from ${entry.status} to ${body.status}` }, { status: 400 });
    }

    if (body.status === "checked_in") {
      db.prepare("INSERT OR IGNORE INTO checkins (jumper_id, date, checkin_type) VALUES (?, date('now'), 'tandem')").run(entry.jumper_id);
    }

    if (body.weight) {
      db.prepare("UPDATE jumpers SET weight = ?, updated_at = datetime('now') WHERE id = ?").run(body.weight, entry.jumper_id);
    }
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of ["status", "emergency_contact_name", "emergency_contact_phone", "photo_package", "video_package", "handcam_package", "addon_total", "payment_status", "payment_notes", "notes", "instructor_id", "load_id"]) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (updates.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

  updates.push("updated_at = datetime('now')");
  values.push(Number(id));

  db.prepare(`UPDATE tandem_reception SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  db.prepare("UPDATE tandem_reception SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(Number(id));
  return NextResponse.json({ success: true });
}
