import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const db = getDb();
    const { jumperId } = await request.json();

    if (!jumperId) return NextResponse.json({ error: "Jumper ID required" }, { status: 400 });

    try {
      db.prepare("INSERT INTO group_members (group_id, jumper_id) VALUES (?, ?)").run(id, jumperId);
    } catch {
      return NextResponse.json({ error: "Already in group" }, { status: 409 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const db = getDb();
    const { jumperId } = await request.json();

    db.prepare("DELETE FROM group_members WHERE group_id = ? AND jumper_id = ?").run(id, jumperId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
