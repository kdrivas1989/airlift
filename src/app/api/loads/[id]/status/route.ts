import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const STATUS_ORDER = ["open", "in_flight", "landed"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const { status: newStatus } = body;

    if (!STATUS_ORDER.includes(newStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const db = getDb();
    const load = db.prepare("SELECT * FROM loads WHERE id = ?").get(id) as { id: number; status: string } | undefined;

    if (!load) return NextResponse.json({ error: "Load not found" }, { status: 404 });

    const currentIdx = STATUS_ORDER.indexOf(load.status);
    const newIdx = STATUS_ORDER.indexOf(newStatus);

    // Only allow forward transitions
    if (newIdx <= currentIdx) {
      return NextResponse.json(
        { error: `Cannot go from ${load.status} to ${newStatus}` },
        { status: 400 }
      );
    }

    if (newStatus === "closed" || newIdx >= STATUS_ORDER.indexOf("closed")) {
      db.prepare("UPDATE loads SET status = ?, closed_at = datetime('now') WHERE id = ?").run(newStatus, id);
    } else {
      db.prepare("UPDATE loads SET status = ? WHERE id = ?").run(newStatus, id);
    }

    const updated = db.prepare("SELECT * FROM loads WHERE id = ?").get(id);
    return NextResponse.json({ load: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
