import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { hashSync } from "bcryptjs";

const DB_PATH = process.env.DB_PATH || (
  process.env.NODE_ENV === "production"
    ? path.join("/data", "manifest.db")
    : path.join(process.cwd(), "data", "manifest.db")
);

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jumpers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      date_of_birth TEXT NOT NULL,
      weight INTEGER NOT NULL,
      uspa_number TEXT UNIQUE,
      license_level TEXT NOT NULL,
      reserve_pack_date TEXT,
      uspa_status TEXT,
      uspa_expiry TEXT,
      uspa_licenses TEXT,
      uspa_verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS waivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jumper_id INTEGER NOT NULL REFERENCES jumpers(id),
      signature_data TEXT NOT NULL,
      initials TEXT NOT NULL,
      is_minor INTEGER NOT NULL DEFAULT 0,
      guardian_name TEXT,
      guardian_signature_data TEXT,
      esignature_consent INTEGER NOT NULL DEFAULT 1,
      marketing_consent INTEGER NOT NULL DEFAULT 0,
      ip_address TEXT,
      signed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_waivers_jumper ON waivers(jumper_id);

    CREATE TABLE IF NOT EXISTS aircraft (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tail_number TEXT NOT NULL UNIQUE,
      name TEXT,
      slot_count INTEGER NOT NULL,
      empty_weight INTEGER NOT NULL,
      max_gross_weight INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      staff_id INTEGER NOT NULL REFERENCES staff(id),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_staff ON sessions(staff_id);

    CREATE TABLE IF NOT EXISTS loads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      load_number INTEGER NOT NULL,
      aircraft_id INTEGER NOT NULL REFERENCES aircraft(id),
      fuel_weight INTEGER NOT NULL DEFAULT 0,
      default_altitude INTEGER NOT NULL DEFAULT 13500,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      created_by INTEGER REFERENCES staff(id)
    );
    CREATE INDEX IF NOT EXISTS idx_loads_status ON loads(status);
    CREATE INDEX IF NOT EXISTS idx_loads_date ON loads(created_at);

    CREATE TABLE IF NOT EXISTS manifest_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      load_id INTEGER NOT NULL REFERENCES loads(id),
      jumper_id INTEGER NOT NULL REFERENCES jumpers(id),
      jump_type TEXT NOT NULL,
      altitude INTEGER NOT NULL,
      exit_order INTEGER NOT NULL,
      ticket_price INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(load_id, jumper_id),
      UNIQUE(load_id, exit_order)
    );
    CREATE INDEX IF NOT EXISTS idx_manifest_jumper ON manifest_entries(jumper_id);
    CREATE INDEX IF NOT EXISTS idx_manifest_load ON manifest_entries(load_id);

    CREATE TABLE IF NOT EXISTS jump_type_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jump_type TEXT NOT NULL UNIQUE,
      price INTEGER NOT NULL,
      label TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jumper_id INTEGER NOT NULL REFERENCES jumpers(id),
      date TEXT NOT NULL DEFAULT (date('now')),
      checked_in_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(jumper_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(date);

    CREATE TABLE IF NOT EXISTS balance_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jumper_id INTEGER NOT NULL REFERENCES jumpers(id),
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_balance_txn_jumper ON balance_transactions(jumper_id);
  `);

  migrate(db);
  seed(db);
}

function migrate(db: Database.Database) {
  // Add USPA verification columns if missing
  const cols = db.prepare("PRAGMA table_info(jumpers)").all() as Array<{ name: string }>;
  const colNames = cols.map(c => c.name);
  if (!colNames.includes("uspa_status")) {
    db.exec(`
      ALTER TABLE jumpers ADD COLUMN uspa_status TEXT;
      ALTER TABLE jumpers ADD COLUMN uspa_expiry TEXT;
      ALTER TABLE jumpers ADD COLUMN uspa_licenses TEXT;
      ALTER TABLE jumpers ADD COLUMN uspa_verified_at TEXT;
    `);
  }
  if (!colNames.includes("balance")) {
    db.exec(`
      ALTER TABLE jumpers ADD COLUMN balance INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE jumpers ADD COLUMN jump_block_remaining INTEGER NOT NULL DEFAULT 0;
    `);
  }

  // Add departure_time to loads
  const loadCols = db.prepare("PRAGMA table_info(loads)").all() as Array<{ name: string }>;
  const loadColNames = loadCols.map(c => c.name);
  if (!loadColNames.includes("departure_time")) {
    db.exec("ALTER TABLE loads ADD COLUMN departure_time TEXT");
  }

  // Add person_type to jumpers (customer, staff, ground — comma-separated)
  if (!colNames.includes("person_type")) {
    db.exec(`
      ALTER TABLE jumpers ADD COLUMN person_type TEXT NOT NULL DEFAULT 'customer';
      ALTER TABLE jumpers ADD COLUMN staff_password_hash TEXT;
      ALTER TABLE jumpers ADD COLUMN staff_role TEXT;
      ALTER TABLE jumpers ADD COLUMN staff_active INTEGER NOT NULL DEFAULT 1;
    `);
    // Migrate existing staff into jumpers table
    const existingStaff = db.prepare("SELECT * FROM staff").all() as Array<Record<string, unknown>>;
    for (const s of existingStaff) {
      const existing = db.prepare("SELECT id FROM jumpers WHERE email = ?").get(s.email) as { id: number } | undefined;
      if (existing) {
        db.prepare("UPDATE jumpers SET person_type = 'customer,staff', staff_password_hash = ?, staff_role = ?, staff_active = ? WHERE id = ?")
          .run(s.password_hash, s.role, s.active, existing.id);
      } else {
        db.prepare(`
          INSERT INTO jumpers (first_name, last_name, email, date_of_birth, weight, license_level, person_type, staff_password_hash, staff_role, staff_active)
          VALUES (?, ?, ?, '1990-01-01', 180, 'unknown', 'staff', ?, ?, ?)
        `).run(s.name, '', s.email, s.password_hash, s.role, s.active);
      }
    }
  }
}

function seed(db: Database.Database) {
  // Seed admin account if no staff exist
  const staffCount = db.prepare("SELECT COUNT(*) as count FROM staff").get() as { count: number };
  if (staffCount.count === 0) {
    const hash = hashSync("Bogus714*", 10);
    db.prepare(
      "INSERT INTO staff (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
    ).run("kdrivas1989@gmail.com", hash, "Kevin Drivas", "admin");
  }

  // Seed jump type pricing if none exist
  const pricingCount = db.prepare("SELECT COUNT(*) as count FROM jump_type_pricing").get() as { count: number };
  if (pricingCount.count === 0) {
    const pricing = [
      { jump_type: "solo", price: 2800, label: "Solo Full Altitude" },
      { jump_type: "tandem", price: 23000, label: "Tandem" },
      { jump_type: "aff", price: 25000, label: "AFF" },
      { jump_type: "hop_n_pop", price: 1800, label: "Hop-n-Pop" },
      { jump_type: "high_altitude", price: 3800, label: "High Altitude" },
      { jump_type: "coach", price: 2800, label: "Coach Jump" },
      { jump_type: "video", price: 2800, label: "Video" },
    ];
    const insert = db.prepare(
      "INSERT INTO jump_type_pricing (jump_type, price, label) VALUES (?, ?, ?)"
    );
    for (const p of pricing) {
      insert.run(p.jump_type, p.price, p.label);
    }
  }

  // Seed sample aircraft if none exist
  const aircraftCount = db.prepare("SELECT COUNT(*) as count FROM aircraft").get() as { count: number };
  if (aircraftCount.count === 0) {
    db.prepare(
      "INSERT INTO aircraft (tail_number, name, slot_count, empty_weight, max_gross_weight) VALUES (?, ?, ?, ?, ?)"
    ).run("N12345", "Twin Otter", 23, 8500, 12500);
  }
}
