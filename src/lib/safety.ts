import Database from "better-sqlite3";

interface SafetyResult {
  ok: boolean;
  error?: string;
}

interface JumperRow {
  id: number;
  reserve_pack_date: string | null;
  weight: number;
}

interface AircraftRow {
  empty_weight: number;
  max_gross_weight: number;
  slot_count: number;
}

interface LoadRow {
  id: number;
  fuel_weight: number;
  aircraft_id: number;
  status: string;
}

/**
 * Check if jumper's reserve pack date is within 180 days.
 */
export function checkReserve(db: Database.Database, jumperId: number): SafetyResult {
  const jumper = db.prepare(
    "SELECT reserve_pack_date FROM jumpers WHERE id = ?"
  ).get(jumperId) as { reserve_pack_date: string | null } | undefined;

  if (!jumper) return { ok: false, error: "Jumper not found" };
  if (!jumper.reserve_pack_date) return { ok: false, error: "No reserve pack date on file" };

  const packDate = new Date(jumper.reserve_pack_date);
  const expiresDate = new Date(packDate.getTime() + 180 * 24 * 60 * 60 * 1000);
  const now = new Date();

  if (now > expiresDate) {
    return { ok: false, error: "Reserve expired \u2014 repack required before manifesting" };
  }
  return { ok: true };
}

/**
 * Check if jumper has a signed waiver on file.
 */
export function checkWaiver(db: Database.Database, jumperId: number): SafetyResult {
  const waiver = db.prepare(
    "SELECT id FROM waivers WHERE jumper_id = ? LIMIT 1"
  ).get(jumperId) as { id: number } | undefined;

  if (!waiver) {
    return { ok: false, error: "Waiver required" };
  }
  return { ok: true };
}

/**
 * Check if adding a jumper would exceed the aircraft's max gross weight.
 */
export function checkWeight(
  db: Database.Database,
  loadId: number,
  jumperWeight: number
): SafetyResult {
  const load = db.prepare("SELECT * FROM loads WHERE id = ?").get(loadId) as LoadRow | undefined;
  if (!load) return { ok: false, error: "Load not found" };

  const aircraft = db.prepare("SELECT * FROM aircraft WHERE id = ?").get(load.aircraft_id) as AircraftRow | undefined;
  if (!aircraft) return { ok: false, error: "Aircraft not found" };

  const currentJumperWeight = db.prepare(
    `SELECT COALESCE(SUM(j.weight), 0) as total
     FROM manifest_entries me
     JOIN jumpers j ON j.id = me.jumper_id
     WHERE me.load_id = ?`
  ).get(loadId) as { total: number };

  const totalWeight = aircraft.empty_weight + load.fuel_weight + currentJumperWeight.total + jumperWeight;

  if (totalWeight > aircraft.max_gross_weight) {
    return {
      ok: false,
      error: `Weight limit exceeded. Current: ${aircraft.empty_weight + load.fuel_weight + currentJumperWeight.total} lbs, Max: ${aircraft.max_gross_weight} lbs, Jumper: ${jumperWeight} lbs`,
    };
  }
  return { ok: true };
}

/**
 * Check if load has available slots.
 */
export function checkSlots(db: Database.Database, loadId: number): SafetyResult {
  const load = db.prepare("SELECT * FROM loads WHERE id = ?").get(loadId) as LoadRow | undefined;
  if (!load) return { ok: false, error: "Load not found" };

  const aircraft = db.prepare("SELECT * FROM aircraft WHERE id = ?").get(load.aircraft_id) as AircraftRow | undefined;
  if (!aircraft) return { ok: false, error: "Aircraft not found" };

  const entryCount = db.prepare(
    "SELECT COUNT(*) as count FROM manifest_entries WHERE load_id = ?"
  ).get(loadId) as { count: number };

  if (entryCount.count >= aircraft.slot_count) {
    return { ok: false, error: "No slots available" };
  }
  return { ok: true };
}

/**
 * Check if jumper is already on an active load (open or boarding).
 */
export function checkDoubleBooking(
  db: Database.Database,
  jumperId: number,
  excludeLoadId?: number
): SafetyResult {
  let query = `
    SELECT l.id, l.load_number
    FROM manifest_entries me
    JOIN loads l ON l.id = me.load_id
    WHERE me.jumper_id = ? AND l.status = 'open'
  `;
  const params: (number | undefined)[] = [jumperId];

  if (excludeLoadId) {
    query += " AND l.id != ?";
    params.push(excludeLoadId);
  }

  const existing = db.prepare(query).get(...params) as { id: number; load_number: number } | undefined;

  if (existing) {
    return {
      ok: false,
      error: `Jumper already manifested on Load #${existing.load_number}`,
    };
  }
  return { ok: true };
}

/**
 * Check if jumper has an active USPA membership.
 */
export function checkUSPA(db: Database.Database, jumperId: number): SafetyResult {
  const jumper = db.prepare(
    "SELECT uspa_number, uspa_status, uspa_verified_at FROM jumpers WHERE id = ?"
  ).get(jumperId) as { uspa_number: string | null; uspa_status: string | null; uspa_verified_at: string | null } | undefined;

  if (!jumper) return { ok: false, error: "Jumper not found" };
  // If status is already Active (e.g. set by boogie registration), allow without USPA number
  if (jumper.uspa_status === "Active") return { ok: true };
  if (!jumper.uspa_number) return { ok: false, error: "No USPA member number on file" };
  if (!jumper.uspa_verified_at) return { ok: false, error: "USPA membership not verified" };
  if (jumper.uspa_status !== "Active") return { ok: false, error: "USPA membership is not active" };

  return { ok: true };
}

/**
 * Run all safety checks for adding a jumper to a load.
 */
export function runAllChecks(
  db: Database.Database,
  loadId: number,
  jumperId: number
): SafetyResult {
  const checkin = db.prepare(
    "SELECT checkin_type FROM checkins WHERE jumper_id = ? AND date = date('now') LIMIT 1"
  ).get(jumperId) as { checkin_type: string } | undefined;
  const isTandemPassenger = checkin?.checkin_type === "tandem";

  if (!isTandemPassenger) {
    const uspaCheck = checkUSPA(db, jumperId);
    if (!uspaCheck.ok) return uspaCheck;

    const reserveCheck = checkReserve(db, jumperId);
    if (!reserveCheck.ok) return reserveCheck;
  }

  const waiverCheck = checkWaiver(db, jumperId);
  if (!waiverCheck.ok) return waiverCheck;

  const jumper = db.prepare("SELECT weight FROM jumpers WHERE id = ?").get(jumperId) as { weight: number } | undefined;
  if (!jumper) return { ok: false, error: "Jumper not found" };

  const weightCheck = checkWeight(db, loadId, jumper.weight);
  if (!weightCheck.ok) return weightCheck;

  const slotCheck = checkSlots(db, loadId);
  if (!slotCheck.ok) return slotCheck;

  const doubleCheck = checkDoubleBooking(db, jumperId, loadId);
  if (!doubleCheck.ok) return doubleCheck;

  return { ok: true };
}

/**
 * Check if a load can be modified (must be open or boarding).
 */
export function checkLoadEditable(db: Database.Database, loadId: number): SafetyResult {
  const load = db.prepare("SELECT status FROM loads WHERE id = ?").get(loadId) as { status: string } | undefined;
  if (!load) return { ok: false, error: "Load not found" };

  if (load.status !== "open") {
    return { ok: false, error: `Cannot modify manifest \u2014 load is ${load.status.replace("_", " ")}` };
  }
  return { ok: true };
}

/**
 * Get current load weight and slot stats.
 */
export function getLoadStats(db: Database.Database, loadId: number) {
  const load = db.prepare("SELECT * FROM loads WHERE id = ?").get(loadId) as LoadRow;
  const aircraft = db.prepare("SELECT * FROM aircraft WHERE id = ?").get(load.aircraft_id) as AircraftRow;

  const jumperWeight = db.prepare(
    `SELECT COALESCE(SUM(j.weight), 0) as total
     FROM manifest_entries me
     JOIN jumpers j ON j.id = me.jumper_id
     WHERE me.load_id = ?`
  ).get(loadId) as { total: number };

  const entryCount = db.prepare(
    "SELECT COUNT(*) as count FROM manifest_entries WHERE load_id = ?"
  ).get(loadId) as { count: number };

  return {
    currentWeight: aircraft.empty_weight + load.fuel_weight + jumperWeight.total,
    maxWeight: aircraft.max_gross_weight,
    slotsUsed: entryCount.count,
    slotsTotal: aircraft.slot_count,
    slotsRemaining: aircraft.slot_count - entryCount.count,
  };
}
