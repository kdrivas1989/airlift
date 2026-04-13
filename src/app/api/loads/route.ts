import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const db = getDb();
    const statusParam = request.nextUrl.searchParams.get("status") || "open,boarding,in_flight";
    const dateParam = request.nextUrl.searchParams.get("date");
    const statuses = statusParam.split(",").map((s) => s.trim());

    let query = `
      SELECT l.*, a.tail_number, a.name as aircraft_name, a.slot_count, a.max_gross_weight, a.empty_weight
      FROM loads l
      JOIN aircraft a ON a.id = l.aircraft_id
      WHERE l.status IN (${statuses.map(() => "?").join(",")})
    `;
    const params: string[] = [...statuses];

    if (dateParam) {
      query += " AND date(l.created_at) = ?";
      params.push(dateParam);
    }

    query += " ORDER BY l.load_number ASC";

    const loads = db.prepare(query).all(...params) as Array<Record<string, unknown>>;

    const result = loads.map((load) => {
      const manifest = db.prepare(`
        SELECT me.*, j.first_name, j.last_name, j.weight, j.id as jumper_id
        FROM manifest_entries me
        JOIN jumpers j ON j.id = me.jumper_id
        WHERE me.load_id = ?
        ORDER BY me.exit_order
      `).all(load.id) as Array<Record<string, unknown>>;

      const jumperWeightTotal = manifest.reduce((sum, m) => sum + (m.weight as number), 0);
      const currentWeight = (load.empty_weight as number) + (load.fuel_weight as number) + jumperWeightTotal;

      return {
        id: load.id,
        loadNumber: load.load_number,
        aircraft: {
          id: load.aircraft_id,
          tailNumber: load.tail_number,
          name: load.aircraft_name,
          slotCount: load.slot_count,
          maxGrossWeight: load.max_gross_weight,
        },
        fuelWeight: load.fuel_weight,
        defaultAltitude: load.default_altitude,
        status: load.status,
        createdAt: load.created_at,
        departureTime: load.departure_time || null,
        slotsUsed: manifest.length,
        slotsAvailable: (load.slot_count as number) - manifest.length,
        currentWeight,
        maxWeight: load.max_gross_weight,
        manifest: manifest.map((m) => ({
          id: m.id,
          jumper: { id: m.jumper_id, firstName: m.first_name, lastName: m.last_name, weight: m.weight },
          jumpType: m.jump_type,
          altitude: m.altitude,
          exitOrder: m.exit_order,
          ticketPrice: m.ticket_price,
        })),
      };
    });

    return NextResponse.json({ loads: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { aircraftId, fuelWeight, defaultAltitude, departureMinutes } = body;

    if (!aircraftId) return NextResponse.json({ error: "Aircraft required" }, { status: 400 });

    const db = getDb();

    // Verify aircraft exists and is active
    const aircraft = db.prepare("SELECT * FROM aircraft WHERE id = ? AND active = 1").get(aircraftId);
    if (!aircraft) return NextResponse.json({ error: "Aircraft not found or inactive" }, { status: 404 });

    // Calculate next load number for today
    const todayCount = db.prepare(
      "SELECT COUNT(*) as count FROM loads WHERE date(created_at) = date('now')"
    ).get() as { count: number };

    // Calculate departure time from minutes
    let departureTime = null;
    if (departureMinutes && departureMinutes > 0) {
      const dep = new Date(Date.now() + departureMinutes * 60 * 1000);
      departureTime = dep.toISOString();
    }

    const result = db.prepare(`
      INSERT INTO loads (load_number, aircraft_id, fuel_weight, default_altitude, created_by, departure_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(todayCount.count + 1, aircraftId, fuelWeight ?? 500, defaultAltitude || 13500, user.staffId, departureTime);

    const load = db.prepare("SELECT * FROM loads WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json({ load }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
