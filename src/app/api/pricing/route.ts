import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();
    const db = getDb();
    const pricing = db.prepare("SELECT * FROM jump_type_pricing ORDER BY jump_type").all();
    return NextResponse.json({ pricing });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { jumpType, price, label } = body;

    if (!jumpType || price === undefined) {
      return NextResponse.json({ error: "Jump type and price required" }, { status: 400 });
    }

    const db = getDb();
    db.prepare(
      "UPDATE jump_type_pricing SET price = ?, label = ?, updated_at = datetime('now') WHERE jump_type = ?"
    ).run(price, label || jumpType, jumpType);

    const pricing = db.prepare("SELECT * FROM jump_type_pricing WHERE jump_type = ?").get(jumpType);
    return NextResponse.json({ pricing });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
