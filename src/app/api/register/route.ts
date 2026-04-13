import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { lookupMember, verifyAndUpdateJumper } from "@/lib/uspa";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, dateOfBirth, weight, uspaNumber, licenseLevel, reservePackDate, password } = body;

    if (!firstName || !lastName || !email || !dateOfBirth || !weight) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDb();

    // Check if jumper already exists by email
    const existing = db.prepare("SELECT id FROM jumpers WHERE email = ?").get(email) as { id: number } | undefined;

    let jumperId: number;
    let isReturning = false;

    if (existing) {
      // Update existing jumper
      const updates = [firstName, lastName, phone || null, dateOfBirth, weight, uspaNumber || null, licenseLevel, reservePackDate || null];
      let updateSql = `UPDATE jumpers SET
          first_name = ?, last_name = ?, phone = ?, date_of_birth = ?,
          weight = ?, uspa_number = ?, license_level = ?, reserve_pack_date = ?,
          updated_at = datetime('now')`;
      if (password) {
        updateSql += ", password_hash = ?";
        updates.push(hashPassword(password));
      }
      updateSql += " WHERE id = ?";
      updates.push(String(existing.id));
      db.prepare(updateSql).run(...updates);

      jumperId = existing.id;
      isReturning = true;
    } else {
      // Create new jumper
      const pwHash = password ? hashPassword(password) : null;
      const result = db.prepare(`
        INSERT INTO jumpers (first_name, last_name, email, phone, date_of_birth, weight, uspa_number, license_level, reserve_pack_date, password_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(firstName, lastName, email, phone || null, dateOfBirth, weight, uspaNumber || null, licenseLevel, reservePackDate || null, pwHash);

      jumperId = result.lastInsertRowid as number;
    }

    // Auto-verify USPA membership in background
    if (uspaNumber) {
      lookupMember(uspaNumber).then((result) => {
        if (result.found && result.member) {
          verifyAndUpdateJumper(jumperId, uspaNumber, result.member);
        }
      }).catch(() => {});
    }

    return NextResponse.json({ jumperId, isReturning });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Registration failed";
    if (message.includes("UNIQUE constraint failed: jumpers.uspa_number")) {
      return NextResponse.json({ error: "USPA number already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
