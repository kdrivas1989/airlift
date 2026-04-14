import { NextRequest, NextResponse } from "next/server";
import { setUSPACookies, lookupMember } from "@/lib/uspa";

/**
 * Bookmarklet endpoint — receives cookies from the browser while user is on uspa.org.
 * CORS enabled so it can be called from any domain.
 */
export async function POST(request: NextRequest) {
  try {
    const { cookies } = await request.json();
    if (!cookies) {
      return NextResponse.json({ error: "No cookies provided" }, { status: 400 });
    }

    setUSPACookies(cookies);

    // Test the cookies
    const test = await lookupMember("232363");

    const response = NextResponse.json({
      valid: test.found,
      error: test.found ? null : (test.error || "Cookies didn't work"),
      member: test.member || null,
    });

    // Allow cross-origin from uspa.org
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failed";
    const response = NextResponse.json({ error: message, valid: false }, { status: 500 });
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
