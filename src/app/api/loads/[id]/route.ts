import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkLoadEditable } from "@/lib/safety";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const editable = checkLoadEditable(db, Number(id));
    if (!editable.ok) return NextResponse.json({ error: editable.error }, { status: 400 });

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.fuelWeight !== undefined) { fields.push("fuel_weight = ?"); values.push(body.fuelWeight); }
    if (body.defaultAltitude !== undefined) { fields.push("default_altitude = ?"); values.push(body.defaultAltitude); }
    if (body.departureMinutes !== undefined) {
      const dep = new Date(Date.now() + body.departureMinutes * 60 * 1000);
      fields.push("departure_time = ?"); values.push(dep.toISOString());
    }
    if (body.departureTime !== undefined) { fields.push("departure_time = ?"); values.push(body.departureTime); }

    if (fields.length > 0) {
      values.push(id);
      db.prepare(`UPDATE loads SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }

    const load = db.prepare("SELECT * FROM loads WHERE id = ?").get(id);
    return NextResponse.json({ load });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
