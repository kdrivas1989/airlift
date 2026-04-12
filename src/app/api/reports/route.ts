import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { toCSV, csvResponse } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const db = getDb();
    const type = request.nextUrl.searchParams.get("type") || "revenue";
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const format = request.nextUrl.searchParams.get("format") || "json";

    if (type === "revenue") {
      let query = `
        SELECT date(l.created_at) as date,
               COUNT(DISTINCT l.id) as load_count,
               SUM(me.ticket_price) as total
        FROM manifest_entries me
        JOIN loads l ON l.id = me.load_id
        WHERE l.status = 'closed'
      `;
      const params: string[] = [];
      if (from) { query += " AND date(l.created_at) >= ?"; params.push(from); }
      if (to) { query += " AND date(l.created_at) <= ?"; params.push(to); }
      query += " GROUP BY date(l.created_at) ORDER BY date DESC";

      const daily = db.prepare(query).all(...params) as Array<{ date: string; load_count: number; total: number }>;

      if (format === "csv") {
        return csvResponse(toCSV(daily), "revenue-report.csv");
      }

      // Summary by jump type
      let typeQuery = `
        SELECT me.jump_type, SUM(me.ticket_price) as total, COUNT(*) as count
        FROM manifest_entries me
        JOIN loads l ON l.id = me.load_id
        WHERE l.status = 'closed'
      `;
      const typeParams: string[] = [];
      if (from) { typeQuery += " AND date(l.created_at) >= ?"; typeParams.push(from); }
      if (to) { typeQuery += " AND date(l.created_at) <= ?"; typeParams.push(to); }
      typeQuery += " GROUP BY me.jump_type";

      const byType = db.prepare(typeQuery).all(...typeParams) as Array<{ jump_type: string; total: number; count: number }>;
      const grandTotal = daily.reduce((s, d) => s + d.total, 0);

      const byJumpType: Record<string, number> = {};
      byType.forEach((t) => { byJumpType[t.jump_type] = t.total; });

      return NextResponse.json({ summary: { total: grandTotal, byJumpType }, daily });
    }

    if (type === "loads") {
      let query = `
        SELECT l.*, a.tail_number,
          (SELECT COUNT(*) FROM manifest_entries WHERE load_id = l.id) as jumper_count,
          (SELECT SUM(ticket_price) FROM manifest_entries WHERE load_id = l.id) as revenue
        FROM loads l
        JOIN aircraft a ON a.id = l.aircraft_id
        WHERE 1=1
      `;
      const params: string[] = [];
      if (from) { query += " AND date(l.created_at) >= ?"; params.push(from); }
      if (to) { query += " AND date(l.created_at) <= ?"; params.push(to); }
      query += " ORDER BY l.created_at DESC LIMIT 200";

      const loads = db.prepare(query).all(...params);

      if (format === "csv") {
        return csvResponse(toCSV(loads as Record<string, unknown>[]), "load-history.csv");
      }

      return NextResponse.json({ loads });
    }

    if (type === "jumpers") {
      let query = `
        SELECT j.*,
          (SELECT COUNT(*) FROM manifest_entries me JOIN loads l ON l.id = me.load_id WHERE me.jumper_id = j.id AND l.status = 'closed') as total_jumps,
          (SELECT COUNT(*) FROM waivers WHERE jumper_id = j.id) as waiver_count
        FROM jumpers j
        WHERE 1=1
      `;
      const params: string[] = [];
      query += " ORDER BY j.last_name, j.first_name";

      const jumpers = db.prepare(query).all(...params);

      if (format === "csv") {
        return csvResponse(toCSV(jumpers as Record<string, unknown>[]), "jumper-list.csv");
      }

      return NextResponse.json({ jumpers });
    }

    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
