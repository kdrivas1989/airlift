import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const jumper = db.prepare("SELECT * FROM jumpers WHERE id = ?").get(user.staffId) as Record<string, unknown> | undefined;
  if (!jumper) return NextResponse.json({ error: "Jumper not found" }, { status: 404 });

  const hasWaiver = (db.prepare("SELECT COUNT(*) as c FROM waivers WHERE jumper_id = ?").get(user.staffId) as { c: number }).c > 0;

  let reserveExpired = true;
  if (jumper.reserve_pack_date) {
    const packDate = new Date(jumper.reserve_pack_date as string);
    const expires = new Date(packDate.getTime() + 180 * 24 * 60 * 60 * 1000);
    reserveExpired = new Date() > expires;
  }

  const uspaActive = (jumper.uspa_status as string) === "Active";

  const reasons: string[] = [];
  if (!hasWaiver) reasons.push("Waiver required");
  if (!jumper.reserve_pack_date || reserveExpired) reasons.push("Reserve repack needed");
  if (!uspaActive) reasons.push("USPA membership not active");

  const canManifest = hasWaiver && !reserveExpired && !!jumper.reserve_pack_date && uspaActive;

  return NextResponse.json({
    id: user.staffId,
    name: user.name,
    balance: (jumper.balance as number) || 0,
    jumpBlockRemaining: (jumper.jump_block_remaining as number) || 0,
    canManifest,
    reason: reasons.length > 0 ? reasons.join(", ") : undefined,
  });
}
