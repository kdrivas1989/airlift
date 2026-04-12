# Implementation Plan: Skydive Manifest Booking System

**Branch**: `012-skydive-manifest` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-skydive-manifest/spec.md`

## Summary

A dropzone manifest management system for skydiving operations. Manages jumper profiles with USPA membership and reserve repack enforcement, aircraft with weight/slot limits, load manifesting with real-time safety checks, and operational reporting. Reuses the swoopleague waiver pattern (SignaturePad, minor detection, legal sections). Built as a Next.js App Router application with SQLite storage and Stripe payments.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20+
**Primary Dependencies**: Next.js 15+ (App Router), React 19, Tailwind CSS 4, better-sqlite3, stripe, @stripe/stripe-js, @stripe/react-stripe-js, bcryptjs, qrcode
**Storage**: SQLite via better-sqlite3 (file: `/data/manifest.db`)
**Testing**: None unless explicitly requested
**Target Platform**: Desktop + tablet browsers (manifest stations at DZ)
**Project Type**: Web application (full-stack Next.js)
**Performance Goals**: Dashboard updates within 2 seconds, jumper search < 500ms
**Constraints**: Safety checks (reserve, weight, waiver) must be server-side enforced — never client-only
**Scale/Scope**: Single DZ, ~200 active jumpers, ~20 loads/day, 2-5 concurrent operators

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Jumper Safety & Compliance | PASS | FR-001–FR-006 cover profiles, reserve repack 180-day enforcement, waiver with SignaturePad/minor detection/guardian fields. Server-side blocks on expired reserve and missing waiver. |
| II. Aircraft & Load Management | PASS | FR-007–FR-011 cover aircraft registration (tail number, slots, weights), fuel tracking, weight calculation formula, max weight + slot enforcement. |
| III. Manifest Accuracy | PASS | FR-012–FR-015 cover no double-booking, load state machine (Open→Boarding→In Flight→Landed→Closed), manifest lock at In Flight, jump type/altitude/exit order per entry. |
| IV. DZ Operations & Reporting | PASS | FR-016–FR-022 cover real-time dashboard, jumper search, pricing/revenue tracking, load history, CSV export, staff auth with Admin/Operator roles, public registration. |

**Gate result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/012-skydive-manifest/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-routes.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx                    # Root layout with providers
│   ├── page.tsx                      # Landing / redirect
│   ├── register/
│   │   └── page.tsx                  # Public jumper registration form
│   ├── waiver/
│   │   └── [jumperId]/
│   │       └── page.tsx              # Public waiver signing page
│   ├── login/
│   │   └── page.tsx                  # Staff login
│   ├── manifest/
│   │   ├── page.tsx                  # Main manifest dashboard (operator)
│   │   └── loads/
│   │       └── [loadId]/
│   │           └── page.tsx          # Load detail / manifest editor
│   ├── admin/
│   │   ├── aircraft/
│   │   │   └── page.tsx              # Aircraft CRUD
│   │   ├── jumpers/
│   │   │   └── page.tsx              # Jumper list + search
│   │   ├── pricing/
│   │   │   └── page.tsx              # Jump type pricing
│   │   ├── staff/
│   │   │   └── page.tsx              # Staff management
│   │   └── reports/
│   │       └── page.tsx              # Revenue + load history + CSV
│   └── api/
│       ├── register/
│       │   └── route.ts              # Public jumper registration
│       ├── waiver/
│       │   └── route.ts              # Public waiver submission
│       ├── auth/
│       │   └── route.ts              # Login/logout
│       ├── jumpers/
│       │   ├── route.ts              # List/search jumpers
│       │   └── [id]/
│       │       └── route.ts          # Get/update jumper
│       ├── aircraft/
│       │   ├── route.ts              # List/create aircraft
│       │   └── [id]/
│       │       └── route.ts          # Get/update/deactivate aircraft
│       ├── loads/
│       │   ├── route.ts              # List/create loads
│       │   └── [id]/
│       │       ├── route.ts          # Get/update load (fuel, altitude)
│       │       ├── manifest/
│       │       │   └── route.ts      # Add/remove jumpers from load
│       │       └── status/
│       │           └── route.ts      # Advance load state
│       ├── pricing/
│       │   └── route.ts              # CRUD jump type pricing
│       ├── reports/
│       │   └── route.ts              # Revenue/history/CSV export
│       └── staff/
│           └── route.ts              # Staff CRUD (admin only)
├── components/
│   ├── SignaturePad.tsx              # Canvas signature capture (from swoopleague)
│   ├── LoadCard.tsx                  # Load summary card for dashboard
│   ├── JumperSearch.tsx              # Autocomplete jumper search
│   ├── ManifestTable.tsx             # Jumper list within a load
│   ├── WeightGauge.tsx               # Visual weight capacity indicator
│   └── ComplianceBadge.tsx           # Waiver/reserve status indicator
└── lib/
    ├── db.ts                         # SQLite connection + schema init
    ├── auth.ts                       # Session management + role checks
    ├── safety.ts                     # Reserve expiry, waiver validation, weight checks
    └── csv.ts                        # CSV export utility
```

**Structure Decision**: Single Next.js App Router project. Public routes (`/register`, `/waiver/*`) are unauthenticated. Staff routes (`/manifest`, `/admin/*`) require auth. API routes handle all data operations with server-side safety enforcement.

## Complexity Tracking

> No constitution violations — table not needed.
