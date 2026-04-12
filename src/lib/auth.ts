import { cookies } from "next/headers";
import { getDb } from "./db";
import { compareSync, hashSync } from "bcryptjs";
import crypto from "crypto";

const SESSION_COOKIE = "manifest_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StaffRow {
  id: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  staff_password_hash: string | null;
  staff_role: string;
  staff_active: number;
  person_type: string;
  // Legacy staff table fields
  name?: string;
  role?: string;
  active?: number;
}

interface SessionRow {
  id: string;
  staff_id: number;
  expires_at: string;
}

export interface AuthUser {
  staffId: number;
  email: string;
  name: string;
  role: "admin" | "operator";
}

export async function login(email: string, password: string): Promise<AuthUser | null> {
  const db = getDb();

  // Try jumpers table first (new unified model)
  const jumper = db.prepare(
    "SELECT * FROM jumpers WHERE email = ? AND person_type LIKE '%staff%' AND staff_active = 1"
  ).get(email) as StaffRow | undefined;

  if (jumper && jumper.staff_password_hash && compareSync(password, jumper.staff_password_hash)) {
    return createSession(db, jumper.id, email, `${jumper.first_name} ${jumper.last_name}`.trim(), jumper.staff_role || "operator");
  }

  // Fallback to legacy staff table
  const staff = db.prepare(
    "SELECT * FROM staff WHERE email = ? AND active = 1"
  ).get(email) as StaffRow | undefined;

  if (!staff) return null;
  if (!compareSync(password, staff.password_hash)) return null;

  return createSession(db, staff.id, staff.email, staff.name || "", (staff.role || "operator") as string);
}

async function createSession(db: ReturnType<typeof getDb>, userId: number, email: string, name: string, role: string): Promise<AuthUser> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  db.prepare("INSERT INTO sessions (id, staff_id, expires_at) VALUES (?, ?, ?)").run(sessionId, userId, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  return { staffId: userId, email, name, role: role as "admin" | "operator" };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    const db = getDb();
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const db = getDb();
  const session = db.prepare(
    "SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')"
  ).get(sessionId) as SessionRow | undefined;

  if (!session) return null;

  // Try jumpers table first
  const jumper = db.prepare(
    "SELECT * FROM jumpers WHERE id = ? AND person_type LIKE '%staff%' AND staff_active = 1"
  ).get(session.staff_id) as StaffRow | undefined;

  if (jumper) {
    return {
      staffId: jumper.id,
      email: jumper.email,
      name: `${jumper.first_name} ${jumper.last_name}`.trim(),
      role: (jumper.staff_role || "operator") as "admin" | "operator",
    };
  }

  // Fallback to legacy staff table
  const staff = db.prepare(
    "SELECT * FROM staff WHERE id = ? AND active = 1"
  ).get(session.staff_id) as StaffRow | undefined;

  if (!staff) return null;

  return {
    staffId: staff.id,
    email: staff.email,
    name: staff.name || "",
    role: (staff.role || "operator") as "admin" | "operator",
  };
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export function hashPassword(password: string): string {
  return hashSync(password, 10);
}
