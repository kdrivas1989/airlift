# API Routes: Skydive Manifest Booking System

**Branch**: `012-skydive-manifest` | **Date**: 2026-04-11

## Public Routes (No Auth)

### POST /api/register
Create or update a jumper profile.

**Request**:
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string",
  "dateOfBirth": "YYYY-MM-DD",
  "weight": 180,
  "uspaNumber": "string",
  "licenseLevel": "A|B|C|D|Tandem|AFF-I|Coach",
  "reservePackDate": "YYYY-MM-DD"
}
```

**Response 200**: `{ "jumperId": 1, "isReturning": false }`
**Response 409**: `{ "error": "Email already registered", "jumperId": 5 }`

### POST /api/waiver
Submit a signed waiver for a jumper.

**Request**:
```json
{
  "jumperId": 1,
  "signatureData": "data:image/png;base64,...",
  "initials": "KD",
  "isMinor": false,
  "guardianName": null,
  "guardianSignatureData": null,
  "esignatureConsent": true,
  "marketingConsent": false
}
```

**Response 200**: `{ "waiverId": 1 }`
**Response 400**: `{ "error": "Guardian signature required for minors" }`

---

## Auth Routes

### POST /api/auth
Login.

**Request**: `{ "email": "string", "password": "string" }`
**Response 200**: `{ "staffId": 1, "name": "string", "role": "admin|operator" }` + Set-Cookie session
**Response 401**: `{ "error": "Invalid credentials" }`

### DELETE /api/auth
Logout. Clears session cookie.

**Response 200**: `{ "ok": true }`

---

## Staff Routes (Require Auth)

### GET /api/jumpers
List/search jumpers.

**Query params**: `?q=search_term` (searches name, email, USPA number)
**Response 200**:
```json
{
  "jumpers": [{
    "id": 1,
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "weight": 180,
    "uspaNumber": "string",
    "licenseLevel": "C",
    "reservePackDate": "2026-02-01",
    "reserveExpired": false,
    "hasWaiver": true,
    "canManifest": true
  }]
}
```

### GET /api/jumpers/[id]
Get jumper detail with waiver history and jump log.

**Response 200**:
```json
{
  "jumper": { ... },
  "waivers": [{ "id": 1, "signedAt": "...", "isMinor": false }],
  "jumpLog": [{ "loadId": 1, "loadNumber": 3, "jumpType": "solo", "altitude": 13500, "date": "..." }]
}
```

### PATCH /api/jumpers/[id]
Update jumper details (weight, reserve pack date, etc.). Staff only.

**Request**: `{ "weight": 185, "reservePackDate": "2026-04-10" }`
**Response 200**: `{ "jumper": { ... } }`

---

### GET /api/aircraft
List all aircraft.

**Query params**: `?active=true` (default: active only)
**Response 200**:
```json
{
  "aircraft": [{
    "id": 1,
    "tailNumber": "N12345",
    "name": "Twin Otter",
    "slotCount": 23,
    "emptyWeight": 8500,
    "maxGrossWeight": 12500,
    "active": true
  }]
}
```

### POST /api/aircraft (Admin only)
Create aircraft.

**Request**:
```json
{
  "tailNumber": "N12345",
  "name": "Twin Otter",
  "slotCount": 23,
  "emptyWeight": 8500,
  "maxGrossWeight": 12500
}
```

**Response 201**: `{ "aircraft": { ... } }`

### PATCH /api/aircraft/[id] (Admin only)
Update or deactivate aircraft.

**Request**: `{ "slotCount": 22, "active": false }`
**Response 200**: `{ "aircraft": { ... } }`

---

### GET /api/loads
List loads.

**Query params**: `?status=open,boarding,in_flight` (default: active loads), `?date=YYYY-MM-DD`
**Response 200**:
```json
{
  "loads": [{
    "id": 1,
    "loadNumber": 3,
    "aircraft": { "id": 1, "tailNumber": "N12345", "slotCount": 23, "maxGrossWeight": 12500 },
    "fuelWeight": 400,
    "defaultAltitude": 13500,
    "status": "open",
    "slotsUsed": 15,
    "slotsAvailable": 8,
    "currentWeight": 11200,
    "maxWeight": 12500,
    "manifest": [{
      "id": 1,
      "jumper": { "id": 1, "firstName": "John", "lastName": "Doe", "weight": 180 },
      "jumpType": "solo",
      "altitude": 13500,
      "exitOrder": 1,
      "ticketPrice": 2800
    }]
  }]
}
```

### POST /api/loads
Create a new load.

**Request**:
```json
{
  "aircraftId": 1,
  "fuelWeight": 400,
  "defaultAltitude": 13500
}
```

**Response 201**: `{ "load": { ... } }`

### PATCH /api/loads/[id]
Update load details (fuel weight, altitude).

**Request**: `{ "fuelWeight": 350 }`
**Response 200**: `{ "load": { ... } }`

### POST /api/loads/[id]/manifest
Add a jumper to the load. Runs all safety checks.

**Request**:
```json
{
  "jumperId": 1,
  "jumpType": "solo",
  "altitude": 13500
}
```

**Response 201**: `{ "entry": { ... }, "loadWeight": 11380, "slotsRemaining": 7 }`
**Response 400**: `{ "error": "Reserve expired — repack required before manifesting" }`
**Response 400**: `{ "error": "Waiver required" }`
**Response 400**: `{ "error": "No slots available" }`
**Response 400**: `{ "error": "Weight limit exceeded. Current: 12400 lbs, Max: 12500 lbs, Jumper: 180 lbs" }`
**Response 409**: `{ "error": "Jumper already manifested on Load #5" }`

### DELETE /api/loads/[id]/manifest
Remove a jumper from the load.

**Request**: `{ "jumperId": 1 }`
**Response 200**: `{ "ok": true, "loadWeight": 11200, "slotsRemaining": 8 }`
**Response 400**: `{ "error": "Cannot modify manifest — load is in flight" }`

### POST /api/loads/[id]/status
Advance load to next state.

**Request**: `{ "status": "boarding" }`
**Response 200**: `{ "load": { ..., "status": "boarding" } }`
**Response 400**: `{ "error": "Invalid transition: cannot go from open to in_flight" }`

---

### GET /api/pricing (Admin only)
List all jump type pricing.

**Response 200**:
```json
{
  "pricing": [{
    "id": 1,
    "jumpType": "solo",
    "label": "Solo Full Altitude",
    "price": 2800,
    "active": true
  }]
}
```

### PUT /api/pricing (Admin only)
Update pricing for a jump type.

**Request**: `{ "jumpType": "solo", "price": 3000, "label": "Solo Full Altitude" }`
**Response 200**: `{ "pricing": { ... } }`

---

### GET /api/reports (Admin only)
Revenue and load history.

**Query params**: `?type=revenue|loads|jumpers`, `?from=YYYY-MM-DD`, `?to=YYYY-MM-DD`, `?format=json|csv`

**Response 200 (revenue)**:
```json
{
  "summary": { "total": 150000, "byJumpType": { "solo": 84000, "tandem": 66000 } },
  "daily": [{ "date": "2026-04-11", "total": 15000, "loadCount": 8 }]
}
```

**Response 200 (csv)**: CSV file download with Content-Disposition header

---

### POST /api/staff (Admin only)
Create staff account.

**Request**: `{ "email": "string", "password": "string", "name": "string", "role": "admin|operator" }`
**Response 201**: `{ "staff": { "id": 1, "email": "...", "name": "...", "role": "operator" } }`

### GET /api/staff (Admin only)
List all staff.

**Response 200**: `{ "staff": [{ "id": 1, "email": "...", "name": "...", "role": "...", "active": true }] }`

### PATCH /api/staff/[id] (Admin only)
Update staff (role, active status, password reset).

**Request**: `{ "role": "admin", "active": false }`
**Response 200**: `{ "staff": { ... } }`
