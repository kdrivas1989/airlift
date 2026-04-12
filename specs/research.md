# Research: Skydive Manifest Booking System

**Branch**: `012-skydive-manifest` | **Date**: 2026-04-11

## Technology Decisions

### Framework: Next.js 15+ (App Router)

- **Decision**: Next.js with App Router, server components, and API routes
- **Rationale**: Consistent with other Kevin projects (swoopleague, booking-system). App Router provides server-side rendering for the dashboard and API routes for data operations in a single deployable unit.
- **Alternatives considered**: Separate Flask API + React SPA (rejected — adds deployment complexity for no benefit)

### Database: SQLite via better-sqlite3

- **Decision**: Single SQLite file at `/data/manifest.db`
- **Rationale**: Consistent with project patterns. Single-DZ deployment with ~200 jumpers and ~20 loads/day is well within SQLite's capacity. Synchronous better-sqlite3 API simplifies transaction handling for atomic manifest operations.
- **Alternatives considered**: PostgreSQL (overkill for single-DZ scale), Prisma (unnecessary abstraction layer for this project)

### Waiver System: Reuse swoopleague pattern

- **Decision**: Port SignaturePad component and waiver flow from `/Users/kevindrivas/swoopleague/`
- **Rationale**: Proven pattern with canvas-based signature capture, legal section acknowledgments, minor detection, guardian fields, and IP audit trail. No need to reinvent.
- **Key files to port**:
  - `swoopleague/src/components/SignaturePad.tsx` — canvas signature capture
  - `swoopleague/src/app/events/[id]/waiver/page.tsx` — waiver form structure (adapt legal sections for skydiving)
  - `swoopleague/src/app/api/waiver/route.ts` — submission handler pattern
- **Adaptations needed**: Replace event-specific context with jumper-specific context, update legal sections for skydiving liability

### Authentication: Session-based with bcryptjs

- **Decision**: Cookie-based sessions with bcryptjs password hashing, two roles (Admin, Operator)
- **Rationale**: Same pattern used in booking-system and swoopleague. Simple, no external auth provider needed for a DZ staff system.
- **Alternatives considered**: NextAuth (too heavy for 2-role internal system)

### Payments: Stripe

- **Decision**: Stripe for jump ticket payments
- **Rationale**: Consistent with other projects. Can handle per-jump charges or end-of-day settlement.
- **Alternatives considered**: Square (less developer-friendly API)

### Weight Calculation Formula

- **Decision**: `total_load_weight = aircraft_empty_weight + fuel_weight + sum(jumper_weights)`
- **Rationale**: Standard aviation weight-and-balance calculation. All weights in lbs (US standard for skydiving operations).
- **Note**: Does not include pilot weight — assumed included in aircraft empty weight configuration or added as a separate manifest entry by the operator.

### Reserve Repack Enforcement

- **Decision**: 180-day hard block calculated from `reserve_pack_date`
- **Rationale**: FAA TSO-C23 requires reserve parachute repack every 180 days. This is a non-negotiable safety requirement.
- **Implementation**: Server-side check on every manifest addition. `reserve_expires = reserve_pack_date + 180 days`. If `today > reserve_expires`, block with clear error message.

### Load State Machine

- **Decision**: Five states — Open → Boarding → In Flight → Landed → Closed
- **Rationale**: Maps to real DZ operations. Forward-only progression (no going backwards). Manifest edits allowed in Open and Boarding only.
- **State constraints**:
  - Open: Full edit (add/remove jumpers, change types, reorder)
  - Boarding: Full edit (last-minute changes common at DZ)
  - In Flight: Read-only manifest, no changes
  - Landed: Read-only, ready for close-out
  - Closed: Archived to history

## No Unresolved Items

All technology choices are defined by the constitution and existing project patterns. No NEEDS CLARIFICATION items remain.
