import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const aircraft = db.prepare("SELECT * FROM aircraft WHERE id = ?").get(id);
    if (!aircraft) return NextResponse.json({ error: "Aircraft not found" }, { status: 404 });

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.tailNumber !== undefined) { fields.push("tail_number = ?"); values.push(body.tailNumber); }
    if (body.name !== undefined) { fields.push("name = ?"); values.push(body.name); }
    if (body.slotCount !== undefined) { fields.push("slot_count = ?"); values.push(body.slotCount); }
    if (body.emptyWeight !== undefined) { fields.push("empty_weight = ?"); values.push(body.emptyWeight); }
    if (body.maxGrossWeight !== undefined) { fields.push("max_gross_weight = ?"); values.push(body.maxGrossWeight); }
    if (body.active !== undefined) { fields.push("active = ?"); values.push(body.active ? 1 : 0); }

    if (fields.length > 0) {
      values.push(id);
      db.prepare(`UPDATE aircraft SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare("SELECT * FROM aircraft WHERE id = ?").get(id);
    return NextResponse.json({ aircraft: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
