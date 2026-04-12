import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const VALID_TRANSITIONS: Record<string, string> = {
  open: "boarding",
  boarding: "in_flight",
  in_flight: "landed",
  landed: "closed",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const { status: newStatus } = body;

    const db = getDb();
    const load = db.prepare("SELECT * FROM loads WHERE id = ?").get(id) as { id: number; status: string } | undefined;

    if (!load) return NextResponse.json({ error: "Load not found" }, { status: 404 });

    const expectedNext = VALID_TRANSITIONS[load.status];
    if (newStatus !== expectedNext) {
      return NextResponse.json(
        { error: `Invalid transition: cannot go from ${load.status} to ${newStatus}` },
        { status: 400 }
      );
    }

    if (newStatus === "closed") {
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
