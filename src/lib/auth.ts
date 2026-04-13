import { cookies } from "next/headers";
import { getDb } from "./db";
import { compareSync, hashSync } from "bcryptjs";
import crypto from "crypto";

const SESSION_COOKIE = "manifest_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const REMEMBER_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // effectively forever

interface JumperRow {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string | null;
  staff_password_hash: string | null;
  staff_role: string | null;
  staff_active: number;
  person_type: string;
}

interface LegacyStaffRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  active: number;
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
  role: "admin" | "operator" | "customer";
  isStaff: boolean;
  personType: string;
}

export async function login(email: string, password: string, rememberMe = false): Promise<AuthUser | null> {
  const db = getDb();

  // Try jumpers table (unified model)
  const jumper = db.prepare("SELECT * FROM jumpers WHERE email = ?").get(email) as JumperRow | undefined;

  if (jumper) {
    // Try password_hash first (everyone's password), then staff_password_hash
    const pwMatch = jumper.password_hash && compareSync(password, jumper.password_hash);
    const staffPwMatch = !pwMatch && jumper.staff_password_hash && compareSync(password, jumper.staff_password_hash);

    if (pwMatch || staffPwMatch) {
      const isStaff = (jumper.person_type || "").includes("staff") && jumper.staff_active === 1;
      const role = isStaff ? (jumper.staff_role || "operator") : "customer";
      return createSession(db, jumper.id, jumper.email,
        `${jumper.first_name} ${jumper.last_name}`.trim(),
        role, isStaff, jumper.person_type || "customer", rememberMe);
    }
  }

  // Fallback to legacy staff table
  const staff = db.prepare("SELECT * FROM staff WHERE email = ? AND active = 1").get(email) as LegacyStaffRow | undefined;
  if (staff && compareSync(password, staff.password_hash)) {
    return createSession(db, staff.id, staff.email, staff.name || "", staff.role || "operator", true, "staff", rememberMe);
  }

  return null;
}

async function createSession(
  db: ReturnType<typeof getDb>, userId: number, email: string,
  name: string, role: string, isStaff: boolean, personType: string, rememberMe = false
): Promise<AuthUser> {
  const duration = rememberMe ? REMEMBER_DURATION_MS : SESSION_DURATION_MS;
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + duration).toISOString();
  db.prepare("INSERT INTO sessions (id, staff_id, expires_at) VALUES (?, ?, ?)").run(sessionId, userId, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: duration / 1000,
  });

  return { staffId: userId, email, name, role: role as AuthUser["role"], isStaff, personType };
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

  // Try legacy staff table first (avoids ID collision with jumpers table)
  const staff = db.prepare("SELECT * FROM staff WHERE id = ? AND active = 1").get(session.staff_id) as LegacyStaffRow | undefined;
  if (staff) {
    // Check if this staff member has been migrated to jumpers
    const jumperByEmail = db.prepare("SELECT * FROM jumpers WHERE email = ? AND person_type LIKE '%staff%'").get(staff.email) as JumperRow | undefined;
    if (jumperByEmail) {
      return {
        staffId: jumperByEmail.id, email: jumperByEmail.email,
        name: `${jumperByEmail.first_name} ${jumperByEmail.last_name}`.trim(),
        role: (jumperByEmail.staff_role || staff.role || "operator") as AuthUser["role"],
        isStaff: true, personType: jumperByEmail.person_type || "staff",
      };
    }
    return {
      staffId: staff.id, email: staff.email, name: staff.name || "",
      role: (staff.role || "operator") as AuthUser["role"], isStaff: true, personType: "staff",
    };
  }

  // Try jumpers table
  const jumper = db.prepare("SELECT * FROM jumpers WHERE id = ?").get(session.staff_id) as JumperRow | undefined;
  if (jumper) {
    const isStaff = (jumper.person_type || "").includes("staff") && jumper.staff_active === 1;
    const role = isStaff ? (jumper.staff_role || "operator") : "customer";
    return {
      staffId: jumper.id, email: jumper.email,
      name: `${jumper.first_name} ${jumper.last_name}`.trim(),
      role: role as AuthUser["role"], isStaff, personType: jumper.person_type || "customer",
    };
  }

  return null;
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireStaff(): Promise<AuthUser> {
  const user = await requireAuth();
  if (!user.isStaff) throw new Error("FORBIDDEN");
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

export function hashPassword(password: string): string {
  return hashSync(password, 10);
}
