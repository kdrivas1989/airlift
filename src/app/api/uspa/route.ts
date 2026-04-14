import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { lookupMember, lookupMemberByName, verifyAndUpdateJumper, setUSPACredentials, getUSPAStatus } from "@/lib/uspa";

// GET /api/uspa — check USPA integration status
export async function GET() {
  try {
    const status = getUSPAStatus();
    return NextResponse.json(status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get USPA status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/uspa — verify a jumper's USPA membership
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jumperId, uspaNumber } = body;

    // Name search: provide firstName + lastName
    if (body.firstName && body.lastName) {
      const results = await lookupMemberByName(body.firstName, body.lastName);
      return NextResponse.json({ results });
    }

    if (!uspaNumber) {
      return NextResponse.json({ error: "USPA number required" }, { status: 400 });
    }

    const result = await lookupMember(uspaNumber);

    if (!result.found || !result.member) {
      return NextResponse.json({ error: result.error || "Member not found" }, { status: 404 });
    }

    // If jumperId provided, update the jumper record
    if (jumperId) {
      const db = getDb();
      const jumper = db.prepare("SELECT id FROM jumpers WHERE id = ?").get(jumperId);
      if (jumper) {
        verifyAndUpdateJumper(jumperId, uspaNumber, result.member);
      }
    }

    return NextResponse.json({ member: result.member });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "USPA verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/uspa — save USPA credentials or cookies and test
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, cookies } = body;

    // If cookies provided directly, save and test them
    if (cookies) {
      setUSPACookies(cookies);
      if (email) setUSPACredentials(email, password || "");

      const testResult = await lookupMember("232363");
      if (!testResult.found) {
        return NextResponse.json({
          saved: true,
          valid: false,
          error: testResult.error || "Cookies didn't work. They may have expired.",
        });
      }
      return NextResponse.json({ saved: true, valid: true, testMember: testResult.member });
    }

    // Otherwise try credential-based login
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required (or provide cookies)" }, { status: 400 });
    }

    setUSPACredentials(email, password);

    const testResult = await lookupMember("232363");
    if (!testResult.found) {
      return NextResponse.json({
        saved: true,
        valid: false,
        error: testResult.error || "Login failed. Try pasting browser cookies instead.",
      });
    }

    return NextResponse.json({ saved: true, valid: true, testMember: testResult.member });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save credentials";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
