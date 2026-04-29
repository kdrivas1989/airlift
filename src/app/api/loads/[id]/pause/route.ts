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
      // Resume: shift departure_time forward by paused duration
      const pausedAt = new Date(load.paused_at as string).getTime();
      const pausedMs = Date.now() - pausedAt;

      if (load.departure_time) {
        const newDep = new Date(new Date(load.departure_time as string).getTime() + pausedMs).toISOString();
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
