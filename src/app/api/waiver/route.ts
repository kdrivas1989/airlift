import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jumperId, signatureData, initials, isMinor, guardianName, guardianSignatureData, esignatureConsent, marketingConsent } = body;

    if (!jumperId || !signatureData || !initials) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!esignatureConsent) {
      return NextResponse.json({ error: "eSignature consent is required" }, { status: 400 });
    }

    if (isMinor && (!guardianName || !guardianSignatureData)) {
      return NextResponse.json({ error: "Guardian signature required for minors" }, { status: 400 });
    }

    const db = getDb();

    // Verify jumper exists
    const jumper = db.prepare("SELECT id FROM jumpers WHERE id = ?").get(jumperId);
    if (!jumper) {
      return NextResponse.json({ error: "Jumper not found" }, { status: 404 });
    }

    // Capture IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    const result = db.prepare(`
      INSERT INTO waivers (jumper_id, signature_data, initials, is_minor, guardian_name, guardian_signature_data, esignature_consent, marketing_consent, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jumperId,
      signatureData,
      initials,
      isMinor ? 1 : 0,
      guardianName || null,
      guardianSignatureData || null,
      esignatureConsent ? 1 : 0,
      marketingConsent ? 1 : 0,
      ip
    );

    return NextResponse.json({ waiverId: result.lastInsertRowid });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Waiver submission failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
