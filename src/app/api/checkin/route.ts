import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();
    const db = getDb();

    const rows = db.prepare(`
      SELECT j.*, c.checked_in_at, c.checkin_type, c.paperwork_complete,
        (SELECT COUNT(*) FROM waivers w WHERE w.jumper_id = j.id) > 0 as has_waiver
      FROM checkins c
      JOIN jumpers j ON j.id = c.jumper_id
      WHERE c.date = date('now')
      ORDER BY c.checked_in_at DESC
    `).all() as Array<Record<string, unknown>>;

    const now = new Date();
    const jumpers = rows.map((j) => {
      let reserveExpired = true;
      if (j.reserve_pack_date) {
        const packDate = new Date(j.reserve_pack_date as string);
        const expiresDate = new Date(packDate.getTime() + 180 * 24 * 60 * 60 * 1000);
        reserveExpired = now > expiresDate;
      }
      const hasWaiver = (j.has_waiver as number) > 0;
      const uspaActive = j.uspa_status === "Active";

      return {
        id: j.id,
        firstName: j.first_name,
        lastName: j.last_name,
        email: j.email,
        weight: j.weight,
        uspaNumber: j.uspa_number,
        licenseLevel: j.license_level,
        balance: j.balance,
        jumpBlockRemaining: j.jump_block_remaining,
        reserveExpired,
        hasWaiver,
        uspaActive,
        canManifest: hasWaiver && !reserveExpired && !!j.reserve_pack_date && uspaActive,
        checkedInAt: j.checked_in_at,
        checkinType: (j.checkin_type as string) || "fun",
        paperworkComplete: (j.paperwork_complete as number) === 1,
        personType: (j.person_type as string) || "customer",
        ratings: (j.ratings as string) || null,
      };
    });

    return NextResponse.json({ jumpers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const db = getDb();
    const { jumperId, checkinType, paperworkComplete } = await request.json();

    if (!jumperId) return NextResponse.json({ error: "Jumper ID required" }, { status: 400 });

    const jumper = db.prepare("SELECT id FROM jumpers WHERE id = ?").get(jumperId);
    if (!jumper) return NextResponse.json({ error: "Jumper not found" }, { status: 404 });

    try {
      db.prepare("INSERT INTO checkins (jumper_id, checkin_type, paperwork_complete) VALUES (?, ?, ?)").run(
        jumperId, checkinType || "fun", paperworkComplete ? 1 : 0
      );
    } catch {
      // Already checked in — update type if provided
      if (checkinType || paperworkComplete !== undefined) {
        const fields: string[] = [];
        const vals: unknown[] = [];
        if (checkinType) { fields.push("checkin_type = ?"); vals.push(checkinType); }
        if (paperworkComplete !== undefined) { fields.push("paperwork_complete = ?"); vals.push(paperworkComplete ? 1 : 0); }
        if (fields.length > 0) {
          vals.push(jumperId);
          db.prepare(`UPDATE checkins SET ${fields.join(", ")} WHERE jumper_id = ? AND date = date('now')`).run(...vals);
        }
      }
      return NextResponse.json({ ok: true, alreadyCheckedIn: true });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
