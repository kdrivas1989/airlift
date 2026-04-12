import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { lookupMultipleMembers, verifyAndUpdateJumper } from "@/lib/uspa";

// POST /api/uspa/bulk — verify all jumpers with USPA numbers
export async function POST() {
  try {
    const db = getDb();

    const jumpers = db.prepare(
      "SELECT id, uspa_number FROM jumpers WHERE uspa_number IS NOT NULL AND uspa_number != ''"
    ).all() as Array<{ id: number; uspa_number: string }>;

    if (jumpers.length === 0) {
      return NextResponse.json({ verified: 0, message: "No jumpers with USPA numbers" });
    }

    const uspaNumbers = jumpers.map(j => j.uspa_number);
    const members = await lookupMultipleMembers(uspaNumbers);

    let verified = 0;
    let notFound = 0;

    for (const jumper of jumpers) {
      const member = members.get(jumper.uspa_number);
      if (member) {
        verifyAndUpdateJumper(jumper.id, jumper.uspa_number, member);
        verified++;
      } else {
        notFound++;
      }
    }

    return NextResponse.json({ verified, notFound, total: jumpers.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bulk verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
