import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.role !== undefined) { fields.push("role = ?"); values.push(body.role); }
    if (body.active !== undefined) { fields.push("active = ?"); values.push(body.active ? 1 : 0); }
    if (body.name !== undefined) { fields.push("name = ?"); values.push(body.name); }
    if (body.password) { fields.push("password_hash = ?"); values.push(hashPassword(body.password)); }

    if (fields.length > 0) {
      values.push(id);
      db.prepare(`UPDATE staff SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }

    const staff = db.prepare("SELECT id, email, name, role, active, created_at FROM staff WHERE id = ?").get(id);
    return NextResponse.json({ staff });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
