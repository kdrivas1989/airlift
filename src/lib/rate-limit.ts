import { NextRequest } from "next/server";

interface AttemptRecord {
  count: number;
  firstAttempt: number;
}

const attempts = new Map<string, AttemptRecord>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Check if a request is rate-limited. Returns null if allowed,
 * or an error message string if blocked.
 */
export function checkRateLimit(request: NextRequest): string | null {
  const ip = getClientIp(request);
  const now = Date.now();
  const record = attempts.get(ip);

  if (record) {
    // Window expired — reset
    if (now - record.firstAttempt > WINDOW_MS) {
      attempts.set(ip, { count: 1, firstAttempt: now });
      return null;
    }

    if (record.count >= MAX_ATTEMPTS) {
      const remainingSec = Math.ceil((WINDOW_MS - (now - record.firstAttempt)) / 1000);
      return `Too many attempts. Try again in ${Math.ceil(remainingSec / 60)} minute(s).`;
    }

    record.count++;
    return null;
  }

  attempts.set(ip, { count: 1, firstAttempt: now });
  return null;
}

// Periodic cleanup of stale entries (runs lazily)
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of attempts) {
    if (now - record.firstAttempt > WINDOW_MS) {
      attempts.delete(ip);
    }
  }
}, 5 * 60 * 1000);
