# Tasks: Skydive Manifest Booking System

**Input**: Design documents from `/specs/012-skydive-manifest/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/api-routes.md, quickstart.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1–US7)
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and dependency installation

- [x] T001 Initialize Next.js 15+ project with TypeScript, Tailwind CSS 4, App Router in project root
- [x] T002 Install dependencies: better-sqlite3, @types/better-sqlite3, bcryptjs, @types/bcryptjs, stripe, @stripe/stripe-js, @stripe/react-stripe-js, qrcode, @types/qrcode
- [x] T003 Configure next.config.ts with port 3007 and any required settings
- [x] T004 Create root layout in src/app/layout.tsx with Tailwind setup and base HTML structure
- [x] T005 Create landing page src/app/page.tsx that redirects staff to /manifest and shows public registration link

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database, auth, and safety infrastructure that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create database module src/lib/db.ts — SQLite connection to /data/manifest.db, schema initialization with all tables (jumpers, waivers, aircraft, loads, manifest_entries, jump_type_pricing, staff, sessions) per data-model.md, indexes, and seed data (admin account kdrivas1989@gmail.com/Bogus714*, sample aircraft Twin Otter N12345, jump type pricing)
- [x] T007 [P] Create auth module src/lib/auth.ts — session creation/validation/deletion, cookie management, role checking helpers (requireAuth, requireAdmin), password hashing with bcryptjs
- [x] T008 [P] Create safety module src/lib/safety.ts — reserve expiry check (180-day calculation), waiver existence check, weight limit check, slot limit check, double-booking check. All functions take db + relevant IDs and return {ok: boolean, error?: string}
- [x] T009 [P] Create CSV export utility src/lib/csv.ts — generic function to convert array of objects to CSV string with Content-Disposition header helper

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 — Jumper Registration & Profile (Priority: P1)

**Goal**: Jumpers can self-register with profile details and sign a waiver. Returning jumpers can look up and update their profile. Reserve expiry is tracked and displayed.

**Independent Test**: Register a jumper at /register, sign waiver at /waiver/[id], verify profile shows compliance status.

### Implementation for User Story 1

- [x] T010 [P] [US1] Create SignaturePad component in src/components/SignaturePad.tsx — port from swoopleague with canvas-based drawing, touch support, clear button, PNG data URL export
- [x] T011 [P] [US1] Create ComplianceBadge component in src/components/ComplianceBadge.tsx — shows green/red indicators for waiver status and reserve expiry status
- [x] T012 [US1] Create POST /api/register route in src/app/api/register/route.ts — validate required fields, create or return existing jumper by email (FR-001), return jumperId
- [x] T013 [US1] Create POST /api/waiver route in src/app/api/waiver/route.ts — validate required fields, check minor status from DOB, require guardian fields if minor, capture IP address, store waiver record (FR-004, FR-005)
- [x] T014 [US1] Create jumper registration page src/app/register/page.tsx — form with name, email, phone, DOB (dropdowns), weight, USPA number, license level (dropdown), reserve pack date. On submit POST to /api/register then redirect to waiver page
- [x] T015 [US1] Create waiver signing page src/app/waiver/[jumperId]/page.tsx — display legal sections with checkbox acknowledgments, SignaturePad for signature, age-based minor detection with conditional guardian fields, submit to POST /api/waiver
- [x] T016 [US1] Create GET /api/jumpers route in src/app/api/jumpers/route.ts — list/search jumpers by name, email, or USPA number (?q= param), include computed reserveExpired, hasWaiver, canManifest fields (FR-017)
- [x] T017 [US1] Create GET/PATCH /api/jumpers/[id] route in src/app/api/jumpers/[id]/route.ts — GET returns jumper detail with waiver history and jump log, PATCH updates weight/reserve pack date (staff only via requireAuth)

**Checkpoint**: Jumpers can register, sign waivers, and be searched. Reserve expiry is tracked.

---

## Phase 4: User Story 2 — Aircraft Management (Priority: P2)

**Goal**: Admins can add, edit, and deactivate aircraft with tail numbers, slot counts, and weight limits.

**Independent Test**: Login as admin, add aircraft at /admin/aircraft, edit slot count, deactivate aircraft.

### Implementation for User Story 2

- [x] T018 [P] [US2] Create GET/POST /api/aircraft route in src/app/api/aircraft/route.ts — GET lists aircraft (?active=true default), POST creates aircraft (admin only via requireAdmin)
- [x] T019 [P] [US2] Create PATCH /api/aircraft/[id] route in src/app/api/aircraft/[id]/route.ts — update tail number, slot count, weights, active status (admin only)
- [x] T020 [US2] Create aircraft management page src/app/admin/aircraft/page.tsx — table of aircraft with add form, inline edit, deactivate toggle. Shows tail number, name, slots, empty weight, max weight, active status

**Checkpoint**: Aircraft can be managed by admins.

---

## Phase 5: User Story 3 — Load Creation & Manifesting (Priority: P1)

**Goal**: Operators create loads, add/remove jumpers with full safety enforcement (weight, slots, reserve, waiver, double-booking).

**Independent Test**: Create load, add jumpers until weight or slot limit blocks, verify expired reserve and missing waiver blocks work.

### Implementation for User Story 3

- [x] T021 [P] [US3] Create JumperSearch component in src/components/JumperSearch.tsx — autocomplete search input that calls GET /api/jumpers?q=, shows results with ComplianceBadge, click to select jumper
- [x] T022 [P] [US3] Create ManifestTable component in src/components/ManifestTable.tsx — table of jumpers on a load showing name, weight, jump type, altitude, exit order, with remove button and drag/reorder for exit order
- [x] T023 [P] [US3] Create WeightGauge component in src/components/WeightGauge.tsx — visual bar showing current load weight vs max, color-coded (green/yellow/red zones)
- [x] T024 [US3] Create GET/POST /api/loads route in src/app/api/loads/route.ts — GET lists loads with manifest entries and computed weight/slot stats (?status= and ?date= filters), POST creates new load with aircraft, fuel weight, default altitude, auto-assigns load_number per day
- [x] T025 [US3] Create PATCH /api/loads/[id] route in src/app/api/loads/[id]/route.ts — update fuel weight and default altitude (only if status is open or boarding)
- [x] T026 [US3] Create POST/DELETE /api/loads/[id]/manifest route in src/app/api/loads/[id]/manifest/route.ts — POST adds jumper with all 5 safety checks from safety.ts (reserve, waiver, weight, slots, double-booking), auto-assigns exit order, looks up ticket price from jump_type_pricing. DELETE removes jumper and releases slot/weight. Both return updated load weight and slots remaining. Block changes if load status is in_flight/landed/closed (FR-003, FR-006, FR-010, FR-011, FR-012, FR-014)
- [x] T027 [US3] Create load detail page src/app/manifest/loads/[loadId]/page.tsx — shows aircraft info, fuel weight (editable), weight gauge, manifest table with jumper search to add, jump type dropdown, altitude input. Full manifest editing for open/boarding loads, read-only for in_flight+

**Checkpoint**: Core manifesting works with all safety enforcement.

---

## Phase 6: User Story 4 — Load State Progression (Priority: P2)

**Goal**: Loads progress through Open → Boarding → In Flight → Landed → Closed with appropriate restrictions at each state.

**Independent Test**: Create a load, advance through all 5 states, verify manifest locks at In Flight.

### Implementation for User Story 4

- [x] T028 [US4] Create POST /api/loads/[id]/status route in src/app/api/loads/[id]/status/route.ts — validate forward-only transitions (open→boarding→in_flight→landed→closed), set closed_at timestamp on close, return updated load (FR-013)
- [x] T029 [US4] Add state progression controls to load detail page src/app/manifest/loads/[loadId]/page.tsx — "Advance" button showing next state, confirmation for In Flight transition (locks manifest), visual state indicator showing current position in lifecycle

**Checkpoint**: Full load lifecycle works with state-based restrictions.

---

## Phase 7: User Story 5 — Manifest Dashboard (Priority: P1)

**Goal**: Real-time dashboard showing all active loads with slot/weight status, jumper search, and quick actions.

**Independent Test**: Dashboard shows active loads with accurate counts, search works, load cards update after changes.

### Implementation for User Story 5

- [x] T030 [P] [US5] Create LoadCard component in src/components/LoadCard.tsx — card showing aircraft tail number, load number, status badge, slots used/total, weight gauge mini, list of manifested jumper names, click to open load detail
- [x] T031 [US5] Create manifest dashboard page src/app/manifest/page.tsx — grid of LoadCard components for all active loads (open, boarding, in_flight), "Create Load" button with aircraft/fuel/altitude form, jumper search bar at top, auto-refresh via polling or client-side state management (FR-016)

**Checkpoint**: Operators have a complete working dashboard for daily operations.

---

## Phase 8: User Story 7 — Staff Authentication (Priority: P2)

**Goal**: Staff login with Admin and Operator roles. Public pages are unauthenticated. Staff pages are protected.

**Independent Test**: Login as admin sees full dashboard + admin sections. Login as operator sees dashboard only. Public registration works without login.

### Implementation for User Story 7

- [x] T032 [P] [US7] Create POST/DELETE /api/auth route in src/app/api/auth/route.ts — POST validates credentials with bcryptjs, creates session, sets cookie. DELETE clears session and cookie (FR-021)
- [x] T033 [P] [US7] Create GET/POST /api/staff route in src/app/api/staff/route.ts — GET lists all staff (admin only), POST creates staff account with hashed password (admin only)
- [x] T034 [P] [US7] Create PATCH /api/staff/[id] route in src/app/api/staff/[id]/route.ts — update role, active status, reset password (admin only)
- [x] T035 [US7] Create login page src/app/login/page.tsx — email/password form, POST to /api/auth, redirect to /manifest on success
- [x] T036 [US7] Create staff management page src/app/admin/staff/page.tsx — list staff with role badges, add staff form, edit role, toggle active status
- [x] T037 [US7] Add auth middleware/checks to all staff routes — wrap /manifest/* and /admin/* pages with auth check, redirect to /login if no session. Add role-based nav: operators see manifest only, admins see manifest + admin sections
- [x] T038 [US7] Create admin jumpers page src/app/admin/jumpers/page.tsx — full jumper list with search, compliance indicators, click to view/edit profile details and waiver history

**Checkpoint**: Authentication works, routes are protected, role-based access enforced.

---

## Phase 9: User Story 6 — Revenue & Reporting (Priority: P3)

**Goal**: Admins set jump pricing, revenue is tracked per manifest entry, reports show daily/weekly/monthly totals with CSV export.

**Independent Test**: Set prices, manifest jumpers, view revenue report, export CSV.

### Implementation for User Story 6

- [x] T039 [P] [US6] Create GET/PUT /api/pricing route in src/app/api/pricing/route.ts — GET lists all jump type pricing, PUT updates price and label for a jump type (admin only) (FR-018)
- [x] T040 [P] [US6] Create GET /api/reports route in src/app/api/reports/route.ts — supports ?type=revenue|loads|jumpers with date range filters, JSON or CSV format via csv.ts utility. Revenue: totals by day/week/month and by jump type. Loads: full manifest history. Jumpers: activity logs (FR-019, FR-020)
- [x] T041 [US6] Create pricing management page src/app/admin/pricing/page.tsx — table of jump types with editable prices and labels, active toggle
- [x] T042 [US6] Create reports page src/app/admin/reports/page.tsx — tab-based view (Revenue, Load History, Jumper Activity) with date range picker, summary cards, data tables, CSV export buttons per section

**Checkpoint**: Full revenue tracking and reporting with CSV export.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T043 Add responsive layout adjustments for tablet screens across all pages
- [x] T044 Add error toast/notification system for API errors across all forms
- [x] T045 Add loading states and skeleton UI to dashboard and list pages
- [x] T046 Run quickstart.md validation — verify full flow: register → waiver → login → create load → manifest → advance states → view reports

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — first story, no other story dependencies
- **US2 (Phase 4)**: Depends on Foundational — independent of US1
- **US3 (Phase 5)**: Depends on Foundational + US1 (needs jumper data) + US2 (needs aircraft data)
- **US4 (Phase 6)**: Depends on US3 (needs loads to exist)
- **US5 (Phase 7)**: Depends on US3 (needs loads + manifest data to display)
- **US7 (Phase 8)**: Depends on Foundational — can run in parallel with US1/US2
- **US6 (Phase 9)**: Depends on US3 (needs manifest entries with pricing)
- **Polish (Phase 10)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: After Foundational — no story dependencies
- **US2 (P2)**: After Foundational — no story dependencies
- **US3 (P1)**: After US1 + US2 (needs jumpers and aircraft)
- **US4 (P2)**: After US3 (needs loads)
- **US5 (P1)**: After US3 (needs loads with manifest data)
- **US7 (P2)**: After Foundational — independent (can parallel with US1/US2)
- **US6 (P3)**: After US3 (needs manifest entries)

### Parallel Opportunities

- T007, T008, T009 can run in parallel (different lib files)
- T010, T011 can run in parallel (different components)
- T018, T019 can run in parallel (different API routes)
- T021, T022, T023 can run in parallel (different components)
- T030 can run in parallel with T028 (different files)
- T032, T033, T034 can run in parallel (different API routes)
- T039, T040 can run in parallel (different API routes)
- US1 and US2 can run in parallel after Foundational
- US7 can run in parallel with US1 and US2

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Jumper Registration & Waivers
4. Complete Phase 4: US2 — Aircraft Management
5. Complete Phase 5: US3 — Load Creation & Manifesting
6. **STOP and VALIDATE**: Full manifest flow works with safety enforcement
7. Deploy MVP

### Incremental Delivery

8. Add US4 — Load State Progression
9. Add US5 — Manifest Dashboard
10. Add US7 — Staff Authentication
11. Add US6 — Revenue & Reporting
12. Complete Polish phase
