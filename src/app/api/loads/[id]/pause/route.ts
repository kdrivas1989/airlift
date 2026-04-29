import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const db = getDb();

    const load = db.prepare("SELECT * FROM loads WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!load) return NextResponse.json({ error: "Load not found" }, { status: 404 });

    const loadNumber = load.load_number as number;
    const now = new Date().toISOString();

    if (load.paused_at) {
      // Resume this load and all later open loads
      const pausedLoads = db.prepare(
        "SELECT * FROM loads WHERE paused_at IS NOT NULL AND status = 'open' AND load_number >= ? ORDER BY load_number ASC"
      ).all(loadNumber) as Array<Record<string, unknown>>;

      for (const pl of pausedLoads) {
        if (pl.departure_time) {
          const pausedAt = new Date(pl.paused_at as string).getTime();
          const depTime = new Date(pl.departure_time as string).getTime();
          const remainingMs = Math.max(0, depTime - pausedAt);
          const newDep = new Date(Date.now() + remainingMs).toISOString();
          db.prepare("UPDATE loads SET departure_time = ?, paused_at = NULL WHERE id = ?").run(newDep, pl.id);
        } else {
          db.prepare("UPDATE loads SET paused_at = NULL WHERE id = ?").run(pl.id);
        }
      }

      return NextResponse.json({ paused: false });
    } else {
      // Pause this load and all later open loads
      const laterLoads = db.prepare(
        "SELECT id FROM loads WHERE status = 'open' AND load_number >= ? AND paused_at IS NULL"
      ).all(loadNumber) as Array<{ id: number }>;

      for (const ll of laterLoads) {
        db.prepare("UPDATE loads SET paused_at = ? WHERE id = ?").run(now, ll.id);
      }

      return NextResponse.json({ paused: true });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
