import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();
    const db = getDb();

    const groups = db.prepare("SELECT * FROM jump_groups ORDER BY name").all() as Array<Record<string, unknown>>;

    const result = groups.map((g) => {
      const members = db.prepare(`
        SELECT j.id, j.first_name, j.last_name, j.weight, j.email
        FROM group_members gm
        JOIN jumpers j ON j.id = gm.jumper_id
        WHERE gm.group_id = ?
        ORDER BY j.last_name
      `).all(g.id) as Array<Record<string, unknown>>;

      return {
        id: g.id,
        name: g.name,
        members: members.map((m) => ({
          id: m.id,
          firstName: m.first_name,
          lastName: m.last_name,
          weight: m.weight,
        })),
      };
    });

    return NextResponse.json({ groups: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const db = getDb();
    const { name, memberIds } = await request.json();

    if (!name) return NextResponse.json({ error: "Group name required" }, { status: 400 });

    const result = db.prepare("INSERT INTO jump_groups (name) VALUES (?)").run(name);
    const groupId = result.lastInsertRowid;

    if (memberIds && Array.isArray(memberIds)) {
      const insert = db.prepare("INSERT OR IGNORE INTO group_members (group_id, jumper_id) VALUES (?, ?)");
      for (const id of memberIds) {
        insert.run(groupId, id);
      }
    }

    return NextResponse.json({ groupId }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
