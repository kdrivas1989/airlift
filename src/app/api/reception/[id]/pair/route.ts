import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { instructorId } = await request.json();
  if (!instructorId) return NextResponse.json({ error: "instructorId required" }, { status: 400 });

  const db = getDb();

  const entry = db.prepare("SELECT * FROM tandem_reception WHERE id = ?").get(Number(id)) as Record<string, unknown> | undefined;
  if (!entry) return NextResponse.json({ error: "Reception entry not found" }, { status: 404 });

  if (entry.status !== "standby") {
    return NextResponse.json({ error: "Can only pair from standby status" }, { status: 400 });
  }

  const alreadyPaired = db.prepare(
    "SELECT id FROM tandem_reception WHERE instructor_id = ? AND date = date('now') AND status IN ('paired', 'manifested')"
  ).get(instructorId);
  if (alreadyPaired) {
    return NextResponse.json({ error: "Instructor is already paired with another tandem" }, { status: 409 });
  }

  db.prepare(
    "UPDATE tandem_reception SET status = 'paired', instructor_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(instructorId, Number(id));

  return NextResponse.json({ success: true });
}
