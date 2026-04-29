import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const jumper = db.prepare("SELECT * FROM jumpers WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!jumper) {
      return NextResponse.json({ error: "Jumper not found" }, { status: 404 });
    }

    const waivers = db.prepare(
      "SELECT id, is_minor, guardian_name, signed_at FROM waivers WHERE jumper_id = ? ORDER BY signed_at DESC"
    ).all(id);

    const jumpLog = db.prepare(`
      SELECT me.load_id, l.load_number, me.jump_type, me.altitude, l.created_at as date
      FROM manifest_entries me
      JOIN loads l ON l.id = me.load_id
      WHERE me.jumper_id = ?
      ORDER BY l.created_at DESC
    `).all(id);

    return NextResponse.json({ jumper, waivers, jumpLog });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch jumper";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const jumper = db.prepare("SELECT * FROM jumpers WHERE id = ?").get(id);
    if (!jumper) {
      return NextResponse.json({ error: "Jumper not found" }, { status: 404 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.firstName !== undefined) { fields.push("first_name = ?"); values.push(body.firstName); }
    if (body.lastName !== undefined) { fields.push("last_name = ?"); values.push(body.lastName); }
    if (body.weight !== undefined) { fields.push("weight = ?"); values.push(body.weight); }
    if (body.reservePackDate !== undefined) { fields.push("reserve_pack_date = ?"); values.push(body.reservePackDate); }
    if (body.phone !== undefined) { fields.push("phone = ?"); values.push(body.phone); }
    if (body.emergencyContactName !== undefined) { fields.push("emergency_contact_name = ?"); values.push(body.emergencyContactName || null); }
    if (body.emergencyContactPhone !== undefined) { fields.push("emergency_contact_phone = ?"); values.push(body.emergencyContactPhone || null); }
    if (body.licenseLevel !== undefined) { fields.push("license_level = ?"); values.push(body.licenseLevel); }
    if (body.uspaNumber !== undefined) { fields.push("uspa_number = ?"); values.push(body.uspaNumber); }
    if (body.uspaStatus !== undefined) { fields.push("uspa_status = ?"); values.push(body.uspaStatus || null); }
    if (body.uspaExpiry !== undefined) { fields.push("uspa_expiry = ?"); values.push(body.uspaExpiry || null); }
    if (body.uspaVerified !== undefined) {
      fields.push("uspa_verified_at = ?");
      values.push(body.uspaVerified ? new Date().toISOString() : null);
    }
    if (body.ratings !== undefined) { fields.push("ratings = ?"); values.push(body.ratings || null); }
    if (body.personType !== undefined) { fields.push("person_type = ?"); values.push(body.personType); }
    if (body.staffRole !== undefined) { fields.push("staff_role = ?"); values.push(body.staffRole); }
    if (body.staffActive !== undefined) { fields.push("staff_active = ?"); values.push(body.staffActive ? 1 : 0); }
    if (body.staffPassword) {
      const { hashSync } = await import("bcryptjs");
      fields.push("staff_password_hash = ?"); values.push(hashSync(body.staffPassword, 10));
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE jumpers SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare("SELECT * FROM jumpers WHERE id = ?").get(id);
    return NextResponse.json({ jumper: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update jumper";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
