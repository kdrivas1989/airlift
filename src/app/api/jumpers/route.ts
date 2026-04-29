import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const db = getDb();

    // Non-staff users only get their own data
    if (!user.isStaff) {
      const j = db.prepare(`
        SELECT j.*,
          (SELECT COUNT(*) FROM waivers w WHERE w.jumper_id = j.id) > 0 as has_waiver
        FROM jumpers j WHERE j.id = ?
      `).get(user.staffId) as Record<string, unknown> | undefined;

      if (!j) return NextResponse.json({ jumpers: [] });

      return NextResponse.json({ jumpers: [formatJumper(j)] });
    }

    // Staff: full search
    const q = request.nextUrl.searchParams.get("q") || "";

    let query = `
      SELECT j.*,
        (SELECT COUNT(*) FROM waivers w WHERE w.jumper_id = j.id) > 0 as has_waiver
      FROM jumpers j
    `;
    const params: string[] = [];

    if (q) {
      query += ` WHERE j.first_name LIKE ? OR j.last_name LIKE ? OR j.email LIKE ? OR j.uspa_number LIKE ?
                  OR (j.first_name || ' ' || j.last_name) LIKE ?`;
      const pattern = `%${q}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    query += " ORDER BY j.last_name, j.first_name LIMIT 100";

    const jumpers = db.prepare(query).all(...params) as Array<Record<string, unknown>>;

    const result = jumpers.map(formatJumper);

    return NextResponse.json({ jumpers: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch jumpers";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function formatJumper(j: Record<string, unknown>) {
  const now = new Date();
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
    phone: j.phone,
    weight: j.weight,
    uspaNumber: j.uspa_number,
    licenseLevel: j.license_level,
    reservePackDate: j.reserve_pack_date,
    uspaStatus: j.uspa_status,
    uspaExpiry: j.uspa_expiry,
    uspaLicenses: j.uspa_licenses,
    uspaVerifiedAt: j.uspa_verified_at,
    reserveExpired,
    hasWaiver,
    uspaActive,
    canManifest: hasWaiver && !reserveExpired && !!j.reserve_pack_date && uspaActive,
    balance: (j.balance as number) || 0,
    jumpBlockRemaining: (j.jump_block_remaining as number) || 0,
    emergencyContactName: j.emergency_contact_name || null,
    emergencyContactPhone: j.emergency_contact_phone || null,
    personType: j.person_type || "customer",
    ratings: j.ratings || null,
    staffRole: j.staff_role || null,
    staffActive: j.staff_active ?? 1,
  };
}
