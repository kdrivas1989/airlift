import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
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

    const jumpers = db.prepare(query).all(...params) as Array<{
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      weight: number;
      uspa_number: string | null;
      license_level: string;
      reserve_pack_date: string | null;
      uspa_status: string | null;
      uspa_expiry: string | null;
      uspa_licenses: string | null;
      uspa_verified_at: string | null;
      has_waiver: number;
      balance: number;
      jump_block_remaining: number;
    }>;

    const now = new Date();

    const result = jumpers.map((j) => {
      let reserveExpired = true;
      if (j.reserve_pack_date) {
        const packDate = new Date(j.reserve_pack_date);
        const expiresDate = new Date(packDate.getTime() + 180 * 24 * 60 * 60 * 1000);
        reserveExpired = now > expiresDate;
      }

      const hasWaiver = j.has_waiver > 0;
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
        balance: j.balance || 0,
        jumpBlockRemaining: j.jump_block_remaining || 0,
        personType: (j as Record<string, unknown>).person_type || "customer",
        staffRole: (j as Record<string, unknown>).staff_role || null,
        staffActive: (j as Record<string, unknown>).staff_active ?? 1,
      };
    });

    return NextResponse.json({ jumpers: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch jumpers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
