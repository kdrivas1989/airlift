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

    if (load.paused_at) {
      // Resume: set departure to now + whatever time was remaining when paused
      if (load.departure_time) {
        const pausedAt = new Date(load.paused_at as string).getTime();
        const depTime = new Date(load.departure_time as string).getTime();
        const remainingMs = Math.max(0, depTime - pausedAt);
        const newDep = new Date(Date.now() + remainingMs).toISOString();
        db.prepare("UPDATE loads SET departure_time = ?, paused_at = NULL WHERE id = ?").run(newDep, id);
      } else {
        db.prepare("UPDATE loads SET paused_at = NULL WHERE id = ?").run(id);
      }

      return NextResponse.json({ paused: false });
    } else {
      // Pause: store current time
      db.prepare("UPDATE loads SET paused_at = ? WHERE id = ?").run(new Date().toISOString(), id);
      return NextResponse.json({ paused: true });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
