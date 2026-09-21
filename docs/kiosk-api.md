# Kiosk API (v6.6.1)

Server endpoints that let a kiosk device act for **one** owner without holding that owner's account.
Source: `server/routes/kiosk.ts`, `server/kiosk/*`. Tests: `tests/kiosk-api-e2e.mts`.

## Trust model
- A tablet creates a pending `terminals` document with a 6-digit pairing code (unchanged).
- The **owner** (Firebase ID token) calls `POST /api/kiosk/terminals/activate {pairingCode}`. The server writes a
  server-only grant `kioskGrants/{terminalId}` and marks the terminal active. **The `terminals` document alone is never
  trusted**: any signed-in user can edit a pending one, so a forged "active" terminal gets no token.
- The **device** calls `POST /api/kiosk/session {terminalId, pairingCode}` and receives a token (30 days, stored hashed in
  `kioskTokens`). Each request re-validates: token, grant, terminal document, and the owner's `kioskMode` plan entitlement
  (cached 30-60s, so revoking or downgrading takes effect within about a minute on every instance).
- Every operation is scoped to `ctx.ownerUid` from the token. No endpoint accepts an owner or user id.
- Ambiguous pairing codes (two pending terminals with the same code) are refused rather than guessed.

## Endpoints
Owner (Firebase ID token): `POST /api/kiosk/terminals/activate`, `POST /api/kiosk/terminals/:id/revoke`.
Device: `POST /api/kiosk/session`, then with `Authorization: Bearer <ptk_...>`:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/kiosk/session/refresh` | rotate the token |
| GET | `/api/kiosk/context` | terminal settings, owner org structure, custom inventories, feature flags, kiosk config |
| GET | `/api/kiosk/items` | paged catalogue: `q` (name prefix), `category`, `status`, `limit` (max 100), `cursor`; `source=inventory&inventoryId=` |
| GET | `/api/kiosk/items/lookup?code=` | scan by id, asset tag (any case) or `/gear/<id>` URL |
| POST | `/api/kiosk/checkout` | `{items:[{id,qty}], holder:{name,email}, signature?, expectedReturnDate?, notes?, source?, inventoryId?}` |
| POST | `/api/kiosk/checkin` | `{items:[{id}], ...}` |
| POST | `/api/kiosk/orders` | create a pending self-service order (names/tags read from the database) |
| GET | `/api/kiosk/orders` | pending orders for this owner |
| POST | `/api/kiosk/orders/:id/fulfill` | release every item and fulfil the order atomically |
| POST | `/api/kiosk/receipt` | email a hand-over receipt (From platform domain, Reply-To owner) |

Multi-item check-out, check-in and order fulfilment are **single transactions**: any conflict (`409` with a `conflicts`
array: `missing`, `already_out`, `restricted`) writes nothing. Limits: 100 items per request.

## Notes
- The catalogue search needs no composite Firestore indexes (name-prefix range, or equality filter + document-id paging).
  The emulator does not enforce indexes, so this is by design, not by test.
- Token and entitlement caches are per instance (30-60s staleness across instances).
- Old kiosk records with `status: 'checked_out'` are closed by check-in alongside `active`.
