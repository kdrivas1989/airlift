import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const db = getDb();
    const staff = db.prepare(
      "SELECT id, email, name, role, active, created_at FROM staff ORDER BY name"
    ).all();
    return NextResponse.json({ staff });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { email, password, name, role } = body;

    if (!email || !password || !name || !role) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }
    if (!["admin", "operator"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const db = getDb();
    const hash = hashPassword(password);
    const result = db.prepare(
      "INSERT INTO staff (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
    ).run(email, hash, name, role);

    const staff = db.prepare(
      "SELECT id, email, name, role, active, created_at FROM staff WHERE id = ?"
    ).get(result.lastInsertRowid);

    return NextResponse.json({ staff }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    if (message.includes("UNIQUE constraint")) return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
