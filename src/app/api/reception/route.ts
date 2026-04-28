import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();

  const entries = db.prepare(`
    SELECT tr.*,
      j.first_name, j.last_name, j.email, j.phone, j.weight, j.date_of_birth,
      (SELECT COUNT(*) FROM waivers w WHERE w.jumper_id = j.id) > 0 as has_waiver,
      ti.first_name as instructor_first_name, ti.last_name as instructor_last_name,
      vid.first_name as videographer_first_name, vid.last_name as videographer_last_name,
      l.load_number
    FROM tandem_reception tr
    JOIN jumpers j ON j.id = tr.jumper_id
    LEFT JOIN jumpers ti ON ti.id = tr.instructor_id
    LEFT JOIN jumpers vid ON vid.id = tr.videographer_id
    LEFT JOIN loads l ON l.id = tr.load_id
    WHERE tr.date = date('now') AND tr.status != 'cancelled'
    ORDER BY
      CASE tr.status
        WHEN 'booked' THEN 1
        WHEN 'checked_in' THEN 2
        WHEN 'standby' THEN 3
        WHEN 'paired' THEN 4
        WHEN 'manifested' THEN 5
      END,
      tr.created_at ASC
  `).all();

  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    firstName, lastName, email, phone, dateOfBirth, weight,
    emergencyContactName, emergencyContactPhone,
    photoPackage, videoPackage, handcamPackage,
    paymentStatus, paymentNotes, notes,
  } = body;

  if (!firstName || !lastName || !weight || !dateOfBirth) {
    return NextResponse.json({ error: "First name, last name, weight, and DOB are required" }, { status: 400 });
  }

  const db = getDb();

  let jumper = db.prepare("SELECT * FROM jumpers WHERE email = ?").get(email || `walkin-${Date.now()}@tandem.local`) as Record<string, unknown> | undefined;

  if (!jumper) {
    const result = db.prepare(`
      INSERT INTO jumpers (first_name, last_name, email, phone, date_of_birth, weight, license_level, jumper_type)
      VALUES (?, ?, ?, ?, ?, ?, 'Student', 'tandem_passenger')
    `).run(firstName, lastName, email || `walkin-${Date.now()}@tandem.local`, phone || null, dateOfBirth, weight);
    jumper = db.prepare("SELECT * FROM jumpers WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>;
  } else {
    db.prepare("UPDATE jumpers SET first_name = ?, last_name = ?, weight = ?, jumper_type = 'tandem_passenger', updated_at = datetime('now') WHERE id = ?")
      .run(firstName, lastName, weight, jumper.id);
  }

  const jumperId = jumper.id as number;

  const existing = db.prepare("SELECT id FROM tandem_reception WHERE jumper_id = ? AND date = date('now')").get(jumperId);
  if (existing) {
    return NextResponse.json({ error: "This person already has a reception entry for today" }, { status: 409 });
  }

  const result = db.prepare(`
    INSERT INTO tandem_reception (jumper_id, date, status, source, emergency_contact_name, emergency_contact_phone, photo_package, video_package, handcam_package, payment_status, payment_notes, notes)
    VALUES (?, date('now'), 'checked_in', 'walkin', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jumperId,
    emergencyContactName || null, emergencyContactPhone || null,
    photoPackage ? 1 : 0, videoPackage ? 1 : 0, handcamPackage ? 1 : 0,
    paymentStatus || "unpaid", paymentNotes || null, notes || null
  );

  db.prepare("INSERT OR IGNORE INTO checkins (jumper_id, date, checkin_type) VALUES (?, date('now'), 'tandem')").run(jumperId);

  return NextResponse.json({ id: result.lastInsertRowid, jumperId }, { status: 201 });
}
