import { getDb } from "./db";

interface USPAMember {
  membershipNumber: string;
  lastName: string;
  firstName: string;
  status: string;
  expDate: string;
  licenses: string;
}

interface USPALookupResult {
  found: boolean;
  member?: USPAMember;
  error?: string;
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value || null;
}

function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  ).run(key, value);
}

// ---------------------------------------------------------------------------
// USPA credentials & session management
// ---------------------------------------------------------------------------

export function setUSPACredentials(email: string, password: string) {
  setSetting("uspa_email", email);
  setSetting("uspa_password", password);
}

export function getUSPAStatus(): { configured: boolean; hasSession: boolean; updatedAt: string | null; email: string | null } {
  const db = getDb();
  const email = getSetting("uspa_email");
  const cookieRow = db.prepare("SELECT updated_at FROM settings WHERE key = 'uspa_cookies'").get() as { updated_at: string } | undefined;
  return {
    configured: !!email,
    hasSession: !!cookieRow,
    updatedAt: cookieRow?.updated_at || null,
    email,
  };
}

export function setUSPACookies(cookies: string) {
  setSetting("uspa_cookies", cookies);
}

/**
 * Log into uspa.org programmatically and store the session cookies.
 * Returns the cookies string on success, or throws on failure.
 */
async function loginToUSPA(): Promise<string> {
  const email = getSetting("uspa_email");
  const password = getSetting("uspa_password");
  if (!email || !password) {
    throw new Error("USPA credentials not configured. Go to Admin > Settings.");
  }

  // Step 1: GET the login page to grab __RequestVerificationToken and initial cookies
  const loginPageRes = await fetch("https://www.uspa.org/Login", {
    redirect: "follow",
  });
  const loginHtml = await loginPageRes.text();

  // Extract __RequestVerificationToken
  const rvtMatch = loginHtml.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
  const rvt = rvtMatch?.[1] || "";

  // Extract __VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION
  const vsMatch = loginHtml.match(/id="__VIEWSTATE"[^>]*value="([^"]*)"/);
  const vsgMatch = loginHtml.match(/id="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/);
  const evMatch = loginHtml.match(/id="__EVENTVALIDATION"[^>]*value="([^"]*)"/);

  // Collect Set-Cookie headers from login page
  const initialCookies = extractSetCookies(loginPageRes.headers);

  // Step 2: POST the login form via ActionForm Submit
  // Find the module ID for the login form (typically 379)
  const midMatch = loginHtml.match(/data-moduleid="(\d+)"[^>]*ng-controller="ActionFormCtrl"/);
  const mid = midMatch?.[1] || "379";

  // Build form data
  const formBody = new URLSearchParams({
    Email: email,
    Password: password,
    Login: "",
    __RequestVerificationToken: rvt,
  });

  const submitUrl = `https://www.uspa.org/DesktopModules/MVC/DnnSharp/ActionForm/Submit?openMode=Always&arePasskeysSupported=false&language=en-US&event=click&b=16109`;

  const submitRes = await fetch(submitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: initialCookies,
      Referer: "https://www.uspa.org/Login",
    },
    body: formBody.toString(),
    redirect: "manual",
  });

  // Collect all cookies from the login response
  const loginCookies = mergeCookies(initialCookies, extractSetCookies(submitRes.headers));

  // Check if we got auth cookies (DNN sets .DOTNETNUKE or similar)
  const responseText = await submitRes.text();

  // The ActionForm might return JSON with a redirect URL on success
  // or it might return a 2FA challenge
  if (responseText.includes("Two-Factor") || responseText.includes("2FA") || responseText.includes("one-time passcode")) {
    throw new Error("USPA account has 2FA enabled. Please provide session cookies manually via Admin > Settings, or disable 2FA on your USPA account.");
  }

  // Follow any redirect to complete the login
  if (submitRes.status === 302 || submitRes.status === 301) {
    const redirectUrl = submitRes.headers.get("Location");
    if (redirectUrl) {
      const followRes = await fetch(
        redirectUrl.startsWith("http") ? redirectUrl : `https://www.uspa.org${redirectUrl}`,
        {
          headers: { Cookie: loginCookies },
          redirect: "manual",
        }
      );
      const finalCookies = mergeCookies(loginCookies, extractSetCookies(followRes.headers));
      setUSPACookies(finalCookies);
      return finalCookies;
    }
  }

  // Check if the response contains redirect info in JSON
  try {
    const json = JSON.parse(responseText);
    if (json.RedirectUrl || json.redirectUrl) {
      const redirectUrl = json.RedirectUrl || json.redirectUrl;
      const followRes = await fetch(
        redirectUrl.startsWith("http") ? redirectUrl : `https://www.uspa.org${redirectUrl}`,
        {
          headers: { Cookie: loginCookies },
          redirect: "manual",
        }
      );
      const finalCookies = mergeCookies(loginCookies, extractSetCookies(followRes.headers));
      setUSPACookies(finalCookies);
      return finalCookies;
    }
  } catch {
    // Not JSON, that's fine
  }

  // If we got new cookies with auth tokens, save them
  if (loginCookies.includes(".DOTNETNUKE") || loginCookies.includes("dnn_")) {
    setUSPACookies(loginCookies);
    return loginCookies;
  }

  // Verify the session works by testing a known endpoint
  const testRes = await fetch("https://www.uspa.org/me", {
    headers: { Cookie: loginCookies },
    redirect: "manual",
  });
  const testBody = await testRes.text();
  if (testBody.includes("Kevin Drivas") || testBody.includes("Sign Out")) {
    setUSPACookies(loginCookies);
    return loginCookies;
  }

  throw new Error("Login appeared to succeed but session verification failed. The login form may have changed or 2FA is required.");
}

function extractSetCookies(headers: Headers): string {
  const cookies: string[] = [];
  // getSetCookie() returns all Set-Cookie headers
  const setCookieHeaders = headers.getSetCookie?.() || [];
  for (const sc of setCookieHeaders) {
    // Extract just the name=value part (before ;)
    const nameValue = sc.split(";")[0].trim();
    if (nameValue) cookies.push(nameValue);
  }
  return cookies.join("; ");
}

function mergeCookies(existing: string, newCookies: string): string {
  const map = new Map<string, string>();
  for (const part of existing.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) map.set(trimmed.substring(0, eq), trimmed);
  }
  for (const part of newCookies.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) map.set(trimmed.substring(0, eq), trimmed);
  }
  return Array.from(map.values()).join("; ");
}

// ---------------------------------------------------------------------------
// Ensure we have a valid session — login if needed
// ---------------------------------------------------------------------------

async function ensureCookies(): Promise<string | null> {
  let cookies = getSetting("uspa_cookies");

  // If we have cookies, test them
  if (cookies) {
    const valid = await testSession(cookies);
    if (valid) return cookies;
  }

  // Try to login
  try {
    cookies = await loginToUSPA();
    return cookies;
  } catch (err) {
    console.error("USPA auto-login failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function testSession(cookies: string): Promise<boolean> {
  try {
    // Quick test: try the member lookup API with a known number
    const params = new URLSearchParams({
      method: "GetData",
      language: "en-US",
      MemNums: "232363",
      TabId: "260",
      _aliasid: "12",
      _mid: "3868",
      _tabid: "260",
      timezone: "-240",
      view: "DataTable",
    });

    const res = await fetch(
      `https://www.uspa.org/DesktopModules/DnnSharp/ActionGrid/Api.ashx?${params.toString()}`,
      {
        method: "POST",
        headers: {
          Cookie: cookies,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "pageSize=1&pageIndex=1",
      }
    );

    if (!res.ok) return false;
    const data = await res.json();
    return data.results && data.results.length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function lookupMember(uspaNumber: string): Promise<USPALookupResult> {
  const cookies = await ensureCookies();
  if (!cookies) {
    return { found: false, error: "USPA session not available. Configure credentials in Admin > Settings." };
  }

  const params = new URLSearchParams({
    method: "GetData",
    language: "en-US",
    MemNums: uspaNumber,
    TabId: "260",
    _aliasid: "12",
    _mid: "3868",
    _tabid: "260",
    timezone: "-240",
    view: "DataTable",
  });

  const url = `https://www.uspa.org/DesktopModules/DnnSharp/ActionGrid/Api.ashx?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Cookie: cookies,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "pageSize=10&pageIndex=1",
    });

    if (!res.ok) {
      return { found: false, error: `USPA API returned ${res.status}. Session may have expired.` };
    }

    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      return { found: false, error: "Member not found in USPA database" };
    }

    const result = data.results[0];
    const fields: Record<string, string> = {};
    for (const f of result.fields) {
      fields[f.Name] = f.FormattedValue || f.Value?.toString() || "";
    }

    return {
      found: true,
      member: {
        membershipNumber: fields.MembershipNumber || uspaNumber,
        lastName: fields.LastName || "",
        firstName: fields.FirstName || "",
        status: fields.Status || "",
        expDate: fields.MemExpDate || "",
        licenses: fields.LicenseList || "",
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { found: false, error: `USPA lookup failed: ${msg}` };
  }
}

export async function lookupMultipleMembers(uspaNumbers: string[]): Promise<Map<string, USPAMember>> {
  const cookies = await ensureCookies();
  if (!cookies) return new Map();

  const params = new URLSearchParams({
    method: "GetData",
    language: "en-US",
    MemNums: uspaNumbers.join(","),
    TabId: "260",
    _aliasid: "12",
    _mid: "3868",
    _tabid: "260",
    timezone: "-240",
    view: "DataTable",
  });

  const url = `https://www.uspa.org/DesktopModules/DnnSharp/ActionGrid/Api.ashx?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Cookie: cookies,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `pageSize=${uspaNumbers.length + 10}&pageIndex=1`,
    });

    if (!res.ok) return new Map();

    const data = await res.json();
    const members = new Map<string, USPAMember>();

    for (const result of data.results || []) {
      const fields: Record<string, string> = {};
      for (const f of result.fields) {
        fields[f.Name] = f.FormattedValue || f.Value?.toString() || "";
      }
      members.set(fields.MembershipNumber, {
        membershipNumber: fields.MembershipNumber,
        lastName: fields.LastName || "",
        firstName: fields.FirstName || "",
        status: fields.Status || "",
        expDate: fields.MemExpDate || "",
        licenses: fields.LicenseList || "",
      });
    }

    return members;
  } catch {
    return new Map();
  }
}

export function verifyAndUpdateJumper(jumperId: number, uspaNumber: string, member: USPAMember) {
  const db = getDb();

  // Parse the highest license from the license list (e.g., "A-57375, B-34026, C-39260, D-36759")
  const licenseList = member.licenses;
  let highestLicense = "";
  if (licenseList.includes("D-")) highestLicense = "D";
  else if (licenseList.includes("C-")) highestLicense = "C";
  else if (licenseList.includes("B-")) highestLicense = "B";
  else if (licenseList.includes("A-")) highestLicense = "A";

  db.prepare(`
    UPDATE jumpers SET
      uspa_status = ?,
      uspa_expiry = ?,
      uspa_licenses = ?,
      uspa_verified_at = datetime('now'),
      license_level = CASE WHEN ? != '' THEN ? ELSE license_level END,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    member.status,
    member.expDate,
    member.licenses,
    highestLicense, highestLicense,
    jumperId
  );
}
