# Data Model: Skydive Manifest Booking System

**Branch**: `012-skydive-manifest` | **Date**: 2026-04-11

## Entities

### jumpers

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK, autoincrement | |
| first_name | TEXT | NOT NULL | |
| last_name | TEXT | NOT NULL | |
| email | TEXT | NOT NULL, UNIQUE | Used for returning jumper lookup |
| phone | TEXT | | |
| date_of_birth | TEXT | NOT NULL | ISO 8601 date (YYYY-MM-DD) |
| weight | INTEGER | NOT NULL | In lbs, self-reported, editable by staff |
| uspa_number | TEXT | UNIQUE | USPA membership number |
| license_level | TEXT | NOT NULL | Enum: A, B, C, D, Tandem, AFF-I, Coach |
| reserve_pack_date | TEXT | | ISO 8601 date. NULL = no reserve info on file |
| created_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

**Computed**: `reserve_expires` = `reserve_pack_date + 180 days` (calculated in queries/app logic, not stored)

### waivers

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK, autoincrement | |
| jumper_id | INTEGER | NOT NULL, FK → jumpers.id | |
| signature_data | TEXT | NOT NULL | PNG data URL from SignaturePad |
| initials | TEXT | NOT NULL | Acknowledgment initials for legal sections |
| is_minor | INTEGER | NOT NULL, DEFAULT 0 | Boolean: 1 if age < 18 at signing |
| guardian_name | TEXT | | Required if is_minor = 1 |
| guardian_signature_data | TEXT | | Required if is_minor = 1 |
| esignature_consent | INTEGER | NOT NULL, DEFAULT 1 | Must be true to submit |
| marketing_consent | INTEGER | NOT NULL, DEFAULT 0 | Optional |
| ip_address | TEXT | | Captured for audit trail |
| signed_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

**Index**: `idx_waivers_jumper` on `jumper_id`

### aircraft

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK, autoincrement | |
| tail_number | TEXT | NOT NULL, UNIQUE | FAA registration (e.g., N12345) |
| name | TEXT | | Friendly name (e.g., "Twin Otter") |
| slot_count | INTEGER | NOT NULL | Max jumpers per load |
| empty_weight | INTEGER | NOT NULL | In lbs, includes pilot |
| max_gross_weight | INTEGER | NOT NULL | In lbs, FAA max takeoff weight |
| active | INTEGER | NOT NULL, DEFAULT 1 | Boolean: 0 = deactivated |
| created_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

### loads

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK, autoincrement | |
| load_number | INTEGER | NOT NULL | Sequential per day, resets daily |
| aircraft_id | INTEGER | NOT NULL, FK → aircraft.id | |
| fuel_weight | INTEGER | NOT NULL, DEFAULT 0 | In lbs, entered by operator/pilot |
| default_altitude | INTEGER | NOT NULL, DEFAULT 13500 | In feet |
| status | TEXT | NOT NULL, DEFAULT 'open' | Enum: open, boarding, in_flight, landed, closed |
| created_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| closed_at | TEXT | | Set when status → closed |
| created_by | INTEGER | FK → staff.id | Operator who created the load |

**Index**: `idx_loads_status` on `status`
**Index**: `idx_loads_date` on `created_at`

### manifest_entries

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK, autoincrement | |
| load_id | INTEGER | NOT NULL, FK → loads.id | |
| jumper_id | INTEGER | NOT NULL, FK → jumpers.id | |
| jump_type | TEXT | NOT NULL | Enum: solo, tandem, aff, hop_n_pop, high_altitude, coach, video |
| altitude | INTEGER | NOT NULL | In feet, defaults to load's default_altitude |
| exit_order | INTEGER | NOT NULL | 1-based position in exit order |
| ticket_price | INTEGER | NOT NULL, DEFAULT 0 | In cents (Stripe convention) |
| created_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

**Unique constraint**: `(load_id, jumper_id)` — one entry per jumper per load
**Unique constraint**: `(load_id, exit_order)` — no duplicate exit positions
**Index**: `idx_manifest_jumper` on `jumper_id`
**Index**: `idx_manifest_load` on `load_id`

### jump_type_pricing

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK, autoincrement | |
| jump_type | TEXT | NOT NULL, UNIQUE | Matches manifest_entries.jump_type enum |
| price | INTEGER | NOT NULL | In cents |
| label | TEXT | NOT NULL | Display name (e.g., "Solo Full Altitude") |
| active | INTEGER | NOT NULL, DEFAULT 1 | Boolean |
| updated_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

### staff

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK, autoincrement | |
| email | TEXT | NOT NULL, UNIQUE | Login email |
| password_hash | TEXT | NOT NULL | bcryptjs hash |
| name | TEXT | NOT NULL | Display name |
| role | TEXT | NOT NULL | Enum: admin, operator |
| active | INTEGER | NOT NULL, DEFAULT 1 | Boolean |
| created_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

### sessions

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | TEXT | PK | UUID session token |
| staff_id | INTEGER | NOT NULL, FK → staff.id | |
| expires_at | TEXT | NOT NULL | ISO 8601 datetime |
| created_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

**Index**: `idx_sessions_staff` on `staff_id`

## Relationships

```
jumpers 1──* waivers          (a jumper can sign multiple waivers over time)
jumpers 1──* manifest_entries  (a jumper appears on many loads)
aircraft 1──* loads            (an aircraft is assigned to many loads)
loads 1──* manifest_entries    (a load has many manifested jumpers)
staff 1──* loads               (a staff member creates many loads)
staff 1──* sessions            (a staff member can have multiple sessions)
```

## State Transitions

### Load Status

```
open → boarding → in_flight → landed → closed
```

- Forward-only (no rollback)
- Manifest editable in: `open`, `boarding`
- Manifest locked in: `in_flight`, `landed`, `closed`

## Safety Validation Rules

1. **Reserve check**: `reserve_pack_date + 180 days > today` — must pass before manifest entry creation
2. **Waiver check**: At least one waiver record exists for jumper — must pass before manifest entry creation
3. **Weight check**: `aircraft.empty_weight + load.fuel_weight + SUM(jumpers.weight for load) + new_jumper.weight <= aircraft.max_gross_weight`
4. **Slot check**: `COUNT(manifest_entries for load) < aircraft.slot_count`
5. **Double-booking check**: Jumper must not have a manifest entry on any load with status in (`open`, `boarding`)
