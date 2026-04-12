# Quickstart: Skydive Manifest Booking System

**Branch**: `012-skydive-manifest` | **Date**: 2026-04-11

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
# Install dependencies
npm install

# Create data directory
mkdir -p /data

# Start dev server (port 3007)
npm run dev
```

The database (`/data/manifest.db`) is created automatically on first request with all tables and seed data.

## Seed Data

On first run, the system seeds:
- **Admin account**: `kdrivas1989@gmail.com` / `Bogus714*`
- **Jump type pricing**: Solo ($28), Tandem ($230), AFF ($250), Hop-n-Pop ($18), High Altitude ($38), Coach ($28), Video ($28)
- **Sample aircraft**: Twin Otter (N12345, 23 slots, 8500 lb empty, 12500 lb max)

## Local Dev Port

**Port 3007** — assigned to avoid conflicts with other projects.

## Key URLs

| URL | Auth | Description |
|-----|------|-------------|
| `/register` | Public | Jumper registration form |
| `/waiver/[jumperId]` | Public | Waiver signing page |
| `/login` | Public | Staff login |
| `/manifest` | Operator+ | Main manifest dashboard |
| `/admin/aircraft` | Admin | Aircraft management |
| `/admin/jumpers` | Admin | Jumper list + search |
| `/admin/pricing` | Admin | Jump type pricing |
| `/admin/staff` | Admin | Staff management |
| `/admin/reports` | Admin | Revenue + load history |

## Test the Flow

1. Open `/register` — create a jumper profile
2. Sign the waiver at `/waiver/[jumperId]`
3. Login at `/login` with admin credentials
4. Go to `/admin/aircraft` — verify seed aircraft exists
5. Go to `/manifest` — create a load with the Twin Otter
6. Search for the registered jumper and add them to the load
7. Advance the load through states: Open → Boarding → In Flight → Landed → Closed

## Deploy (Coolify)

```bash
# Build
npm run build

# Start production
npm start
```

Database file persists at `/data/manifest.db`. Ensure the `/data` directory is mounted as a persistent volume in Coolify.
