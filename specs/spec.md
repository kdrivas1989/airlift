# Feature Specification: Skydive Manifest Booking System

**Feature Branch**: `012-skydive-manifest`
**Created**: 2026-04-11
**Status**: Draft
**Input**: User description: "Skydive manifest booking system with jumper profiles, waivers, aircraft management, load manifesting, and DZ operations"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Jumper Registration & Profile (Priority: P1)

A new jumper arrives at the dropzone. They need to create a profile with their personal details, USPA membership, license level, weight, and reserve pack job date. They must sign a waiver before they can be manifested on any load. Returning jumpers can look up their existing profile and update details (weight changes, new reserve repack date).

**Why this priority**: No manifesting can happen without jumper profiles and waivers. This is the entry point for every jumper interaction.

**Independent Test**: A jumper can register, sign the waiver, and their profile shows as "ready to manifest" with valid waiver and non-expired reserve.

**Acceptance Scenarios**:

1. **Given** a new jumper at the DZ, **When** they fill out the registration form with name, email, phone, weight, USPA number, license level, DOB, and reserve pack date, **Then** a profile is created and they are prompted to sign the waiver.
2. **Given** a jumper completing registration, **When** they acknowledge all legal sections and provide a signature via SignaturePad, **Then** the waiver is recorded with timestamp, IP address, and signature data.
3. **Given** a minor (under 18) registering, **When** age is calculated from DOB, **Then** guardian name and guardian signature fields appear and are required.
4. **Given** a jumper whose reserve was packed 181+ days ago, **When** their profile is viewed, **Then** the system displays a red "RESERVE EXPIRED" warning and blocks manifesting.
5. **Given** a returning jumper, **When** they search by name or USPA number, **Then** their existing profile loads with current compliance status.

---

### User Story 2 - Aircraft Management (Priority: P2)

A DZ admin needs to register aircraft used for jump operations. Each aircraft has a tail number (registration), configurable slot count, empty weight, and maximum allowable gross weight. The admin can add, edit, and deactivate aircraft.

**Why this priority**: Aircraft must exist before loads can be created. This is the second foundational data requirement.

**Independent Test**: An admin can add an aircraft with tail number N12345, 23 slots, and weight limits, then edit its details.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they add a new aircraft with tail number, slot count, empty weight, and max gross weight, **Then** the aircraft appears in the aircraft list and is available for load creation.
2. **Given** an existing aircraft, **When** the admin edits slot count or weight limits, **Then** future loads reflect the updated values.
3. **Given** an aircraft, **When** the admin deactivates it, **Then** it no longer appears as an option when creating new loads but historical loads remain intact.

---

### User Story 3 - Load Creation & Manifesting (Priority: P1)

A manifest operator creates a new load by selecting an aircraft and setting the altitude and fuel weight. They then add jumpers to the load by searching for them, assigning a jump type, and placing them in exit order. The system enforces slot limits, weight limits, and compliance checks (waiver signed, reserve not expired) in real time.

**Why this priority**: This is the core workflow — the reason the system exists. Tied with P1 because it depends on jumper profiles but is equally essential.

**Independent Test**: An operator creates a load, adds jumpers until slots or weight limit is reached, and the system correctly blocks further additions.

**Acceptance Scenarios**:

1. **Given** a manifest operator, **When** they create a new load selecting an aircraft and entering fuel weight, **Then** a load is created in "Open" status showing available slots and remaining weight capacity.
2. **Given** an open load, **When** the operator searches for a jumper and adds them, **Then** the jumper's weight is added to the load total, a slot is consumed, and the manifest updates.
3. **Given** a load where adding a jumper would exceed max gross weight, **When** the operator attempts to add them, **Then** the system blocks the addition with a clear weight limit warning showing current vs. max weight.
4. **Given** a load with all slots filled, **When** the operator attempts to add another jumper, **Then** the system blocks with a "No slots available" message.
5. **Given** a jumper with an expired reserve, **When** the operator tries to manifest them, **Then** the system blocks with "Reserve expired — repack required before manifesting."
6. **Given** a jumper without a signed waiver, **When** the operator tries to manifest them, **Then** the system blocks with "Waiver required."
7. **Given** a jumper already on an active load (Open or Boarding), **When** the operator tries to add them to another load, **Then** the system blocks with "Jumper already manifested on Load #X."
8. **Given** an open load, **When** the operator assigns jump types (solo, tandem, AFF, hop-n-pop, high-altitude) and sets exit order, **Then** the manifest reflects the assignments.
9. **Given** a load in Open or Boarding status, **When** the operator removes a jumper, **Then** the slot and weight are released.

---

### User Story 4 - Load State Progression (Priority: P2)

Loads progress through a defined lifecycle: Open → Boarding → In Flight → Landed → Closed. The manifest operator advances loads through each state. Modifications are restricted based on state (e.g., no adding jumpers once In Flight).

**Why this priority**: State management ensures operational safety and data integrity. Required for a usable manifest system.

**Independent Test**: A load can be created, moved through all states, and editing restrictions are enforced at each state.

**Acceptance Scenarios**:

1. **Given** a load in "Open" status, **When** the operator advances it, **Then** the status changes to "Boarding."
2. **Given** a load in "Boarding" status, **When** the operator advances it, **Then** the status changes to "In Flight" and the manifest is locked (no adding/removing jumpers).
3. **Given** a load "In Flight", **When** the operator advances it, **Then** the status changes to "Landed."
4. **Given** a load "Landed", **When** the operator closes it, **Then** the status changes to "Closed" and it moves to load history.
5. **Given** a load in "In Flight" or later status, **When** the operator tries to add or remove a jumper, **Then** the system prevents the change.
6. **Given** a load in "Open" or "Boarding" status, **When** the operator moves a jumper to a different load, **Then** both loads update correctly.

---

### User Story 5 - Manifest Dashboard (Priority: P1)

The manifest operator sees a real-time dashboard showing all active loads (not Closed), their aircraft, fill status (slots used/available), weight status (current/max), and current state. They can quickly create loads, search jumpers, and manage the day's operations from one screen.

**Why this priority**: The dashboard is the primary interface — operators live in this view all day.

**Independent Test**: The dashboard displays active loads with accurate slot counts and weight totals, and all quick actions work.

**Acceptance Scenarios**:

1. **Given** the manifest dashboard, **When** loads exist in Open, Boarding, or In Flight states, **Then** each load card shows: aircraft tail number, status, slots used/total, weight used/max, and manifested jumper names.
2. **Given** the dashboard, **When** the operator uses the jumper search bar, **Then** results appear by name or USPA number with compliance status indicators (green = ready, red = issue).
3. **Given** the dashboard, **When** a jumper is added or removed from a load, **Then** the load card updates immediately without page refresh.

---

### User Story 6 - Revenue & Reporting (Priority: P3)

The system tracks jump ticket pricing per manifest entry. Admins can set prices per jump type. The reporting section shows daily/weekly/monthly revenue, load history with full manifests, and jumper activity logs. CSV export is available for manifests and jumper lists.

**Why this priority**: Revenue and reporting are important but not required for the manifest to function operationally.

**Independent Test**: An admin sets jump prices, jumpers are manifested with pricing recorded, and a revenue report shows accurate totals with CSV export.

**Acceptance Scenarios**:

1. **Given** an admin, **When** they set prices for each jump type (solo, tandem, AFF, etc.), **Then** prices are saved and applied to new manifest entries.
2. **Given** manifested jumpers with pricing, **When** an admin views the revenue report, **Then** totals are shown by day, week, and month with breakdowns by jump type.
3. **Given** the load history view, **When** an admin selects a past load, **Then** the full manifest is displayed (all jumpers, jump types, weights, exit order).
4. **Given** any list view (manifests, jumpers, revenue), **When** the user clicks "Export CSV", **Then** a properly formatted CSV file downloads.
5. **Given** a jumper profile, **When** viewing their activity log, **Then** all past jumps are listed with date, load number, jump type, and altitude.

---

### User Story 7 - Staff Authentication (Priority: P2)

DZ staff access the manifest system through a login. Two roles exist: Admin (full access including aircraft management, pricing, and user management) and Operator (can create loads, manifest jumpers, advance load states). The public-facing side is only the jumper registration and waiver form.

**Why this priority**: Authentication is needed to protect manifest operations but the system can be prototyped without it initially.

**Independent Test**: An admin can log in, create staff accounts, and an operator can log in with restricted access.

**Acceptance Scenarios**:

1. **Given** a staff member, **When** they navigate to the manifest system, **Then** they see a login page requiring email and password.
2. **Given** valid admin credentials, **When** they log in, **Then** they see the full dashboard with admin sections (aircraft, pricing, staff management).
3. **Given** valid operator credentials, **When** they log in, **Then** they see the manifest dashboard without admin sections.
4. **Given** a public user, **When** they navigate to the registration/waiver page, **Then** no login is required.

---

### Edge Cases

- What happens when a jumper's reserve expires while they are already manifested on an open load? The system MUST warn the operator but not auto-remove them (the repack may have just been logged late).
- What happens if an aircraft's max weight is reduced below the current load weight? The system MUST warn but allow the edit, flagging the affected loads.
- What happens when the same email is used to register twice? The system MUST treat email as unique — show the existing profile for updates.
- What happens if a load has zero jumpers when advanced to Boarding? The system MUST allow it (ferry flights exist).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow jumper self-registration with name, email, phone, DOB, weight, USPA membership number, and license level (A/B/C/D/Tandem/AFF-I/Coach).
- **FR-002**: System MUST capture reserve pack job date per jumper and calculate expiration (180 days from pack date per FAA regulations).
- **FR-003**: System MUST block manifesting any jumper whose reserve pack date is expired.
- **FR-004**: System MUST provide a waiver signing flow with legal section acknowledgments, canvas-based signature capture, minor detection (age < 18), and conditional guardian fields.
- **FR-005**: System MUST store waiver data including signature image, timestamp, IP address, and all acknowledgments.
- **FR-006**: System MUST block manifesting any jumper without a signed waiver on file.
- **FR-007**: System MUST allow admins to register aircraft with tail number, slot count, empty weight, and max allowable gross weight.
- **FR-008**: System MUST track fuel weight per load (entered by operator or pilot).
- **FR-009**: System MUST calculate total load weight as: sum(jumper weights) + fuel weight + aircraft empty weight.
- **FR-010**: System MUST prevent adding a jumper to a load if total weight would exceed aircraft max gross weight.
- **FR-011**: System MUST prevent adding a jumper to a load if all slots are filled.
- **FR-012**: System MUST prevent double-booking a jumper on two simultaneously active loads.
- **FR-013**: System MUST support load states: Open → Boarding → In Flight → Landed → Closed.
- **FR-014**: System MUST lock manifest changes (add/remove jumpers) once a load reaches "In Flight" status.
- **FR-015**: System MUST allow manifest operators to set jump type, requested altitude, and exit order per jumper on a load.
- **FR-016**: System MUST provide a real-time manifest dashboard showing all active loads with fill and weight status.
- **FR-017**: System MUST support jumper search by name or USPA number.
- **FR-018**: System MUST track jump ticket pricing per jump type and record revenue per manifest entry.
- **FR-019**: System MUST provide load history and jumper activity logs.
- **FR-020**: System MUST support CSV export for manifests, jumper lists, and revenue reports.
- **FR-021**: System MUST authenticate staff with email/password and support Admin and Operator roles.
- **FR-022**: Jumper registration and waiver signing MUST be publicly accessible without login.

### Key Entities

- **Jumper**: A person who skydives. Has personal info, USPA membership, license level, weight, reserve pack date, and waiver status. Can be manifested on loads.
- **Waiver**: A signed legal agreement tied to a jumper. Contains legal acknowledgments, signature data, guardian info (if minor), and audit metadata.
- **Aircraft**: A jump plane registered at the DZ. Has tail number, slot capacity, empty weight, and max gross weight.
- **Load**: A single aircraft sortie. Assigned to an aircraft with fuel weight, altitude, and a list of manifested jumpers. Progresses through lifecycle states.
- **Manifest Entry**: A jumper's slot on a specific load. Includes jump type, exit order, altitude, and ticket price.
- **Staff**: An authenticated user who operates the manifest system. Has a role (Admin or Operator).
- **Jump Type**: A category of skydive (solo, tandem, AFF, hop-n-pop, high-altitude, etc.) with associated pricing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new jumper can complete registration and waiver signing in under 5 minutes.
- **SC-002**: A manifest operator can create a load and add 15 jumpers in under 3 minutes.
- **SC-003**: The system correctly blocks 100% of manifest attempts for jumpers with expired reserves or missing waivers.
- **SC-004**: Weight calculations are accurate to within 1 lb and overweight loads are blocked 100% of the time.
- **SC-005**: The manifest dashboard reflects load changes within 2 seconds of any update.
- **SC-006**: Load history is searchable and complete for all past operations.
- **SC-007**: CSV exports contain all relevant data fields and are importable into standard spreadsheet applications.

## Assumptions

- Jumpers have access to a tablet or kiosk at the DZ for self-registration and waiver signing.
- USPA membership validation is manual (no API integration with USPA) — operators verify visually from the member card.
- Weights are self-reported by jumpers and may be adjusted by manifest operators.
- Single-DZ deployment — no multi-location support needed for v1.
- Fuel weight is entered manually by staff per load (no avionics integration).
- Payment processing via Stripe is for jump ticket charges at manifest time or end-of-day settlement.
- The system operates on a single timezone configured at setup.
- Tandem jumpers include both the instructor and student as a single manifest entry with combined weight.
