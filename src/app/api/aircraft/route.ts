import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const db = getDb();
    const activeOnly = request.nextUrl.searchParams.get("active") !== "false";

    const query = activeOnly
      ? "SELECT * FROM aircraft WHERE active = 1 ORDER BY tail_number"
      : "SELECT * FROM aircraft ORDER BY tail_number";

    const aircraft = db.prepare(query).all();
    return NextResponse.json({ aircraft });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { tailNumber, name, slotCount, emptyWeight, maxGrossWeight } = body;

    if (!tailNumber || !slotCount || !emptyWeight || !maxGrossWeight) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare(
      "INSERT INTO aircraft (tail_number, name, slot_count, empty_weight, max_gross_weight) VALUES (?, ?, ?, ?, ?)"
    ).run(tailNumber, name || null, slotCount, emptyWeight, maxGrossWeight);

    const aircraft = db.prepare("SELECT * FROM aircraft WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json({ aircraft }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    if (message.includes("UNIQUE constraint")) return NextResponse.json({ error: "Tail number already exists" }, { status: 409 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
