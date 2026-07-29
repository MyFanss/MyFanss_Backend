# Tips API

Tips are a payment **stub** — no real PSP is charged. The module models the
full lifecycle a hardened frontend needs: a fee-quoted intent, an explicit
confirm step, idempotency, and separate fan/creator views. There is no plain
`POST /tips` insert; every tip goes through the same intent + confirm logic
even when called through the shorthand endpoint.

All routes are documented in Swagger under the **Tips** tag at `/api/v1/docs`.

## Data model

`Tip`:

| Field             | Type      | Notes                                              |
| ----------------- | --------- | --------------------------------------------------- |
| `id`               | uuid      | Primary key                                        |
| `fanId`            | int       | FK → `users.id`, the tipper                        |
| `creatorId`        | int       | FK → `users.id`, must have role `creator`          |
| `amountCents`      | int       | Gross tip amount, before fees                      |
| `currency`         | varchar(3)| ISO 4217, default `USD`                            |
| `message`          | varchar   | nullable, max 500 chars                            |
| `status`           | enum      | `pending` \| `completed` \| `failed` \| `cancelled` |
| `idempotencyKey`   | varchar   | unique                                             |
| `feeCents`         | int       | Server-computed, `TIP_PLATFORM_FEE_BPS`             |
| `creatorNetCents`  | int       | `amountCents - feeCents`                           |
| `createdAt` / `updatedAt` | timestamp | Set on creation / update                    |
| `confirmedAt`      | timestamp | nullable, set when confirm resolves                |

There is no separate `TipIntent` entity — a `Tip` row **is** the intent from
the moment it's created, starting in `pending` and moving to a terminal state
(`completed`/`failed`) only via the confirm step.

## Fee schedule

Fees are computed server-side, never trusted from the client:

```
feeCents = round(amountCents * TIP_PLATFORM_FEE_BPS / 10000)
creatorNetCents = amountCents - feeCents
```

Configured via env (see `.env.example`):

| Var                     | Default | Meaning                          |
| ----------------------- | ------- | --------------------------------- |
| `TIP_PLATFORM_FEE_BPS`  | `500`   | Basis points (500 = 5%)          |
| `TIP_MIN_AMOUNT_CENTS`  | `100`   | Minimum tip, in cents ($1.00)    |
| `TIP_MAX_AMOUNT_CENTS`  | `100000`| Maximum tip, in cents ($1,000.00)|

## Endpoints

| Method | Path                              | Auth   | Description                                  |
| ------ | --------------------------------- | ------ | --------------------------------------------- |
| POST   | `/tips/intents`                   | Bearer | Create a pending tip quote                    |
| POST   | `/tips/intents/:id/confirm`       | Bearer | Complete (or fail) a pending intent           |
| POST   | `/tips`                           | Bearer | Shorthand: intent + confirm in one call       |
| GET    | `/tips/me`                        | Bearer | Fan's own tip history (paginated)             |
| GET    | `/creators/me/tips`               | Bearer | Creator's own tip inbox (paginated)           |

> Note: this repo does not apply a global `/api/v1` route prefix (see other
> modules for the same convention), so routes are mounted at the paths above,
> not under `/api/v1`.

### POST /tips/intents

Creates a pending tip with a server-computed fee quote.

```bash
curl -X POST http://localhost:3000/tips/intents \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{ "creatorId": 3, "amountCents": 1000, "message": "love your work!" }'
```

`201 Created`:

```json
{
  "id": "b7e0...",
  "fanId": 5,
  "creatorId": 3,
  "amountCents": 1000,
  "currency": "USD",
  "message": "love your work!",
  "status": "pending",
  "feeCents": 50,
  "creatorNetCents": 950,
  "createdAt": "2026-07-29T10:00:00.000Z",
  "updatedAt": "2026-07-29T10:00:00.000Z",
  "confirmedAt": null
}
```

Errors:

- `400 Bad Request` — tipping yourself, `amountCents` out of bounds, or
  `message` over 500 characters.
- `401 Unauthorized` — missing/invalid access token.
- `404 Not Found` — `creatorId` does not exist or is not a creator (both
  cases return the same message so callers can't enumerate users).
- `409 Conflict` — the `Idempotency-Key` was already used by a different fan.

#### Idempotency

Pass `Idempotency-Key` as a header (preferred) or `idempotencyKey` in the
body. Replaying the same key returns the **original** tip unchanged — no
duplicate row is created, even under concurrent requests (a unique DB
constraint on `idempotencyKey` is the source of truth; a race that hits the
constraint re-reads and returns the winning row instead of erroring). If no
key is supplied, one is generated server-side and the call is *not*
idempotent.

### POST /tips/intents/:id/confirm

Completes the stub charge. Only the fan who created the intent can confirm
it; any other caller (including the creator) gets `404` so tip existence
isn't leaked.

```bash
curl -X POST http://localhost:3000/tips/intents/$TIP_ID/confirm \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

`201 Created` — the tip with `status: "completed"` and `confirmedAt` set.

Confirming an already-**completed** tip is idempotent and simply returns the
same tip again (no duplicate audit entry, no re-save). Confirming a tip that
is already `failed` or `cancelled` is a `409 Conflict` — those are terminal
states.

For test/stub purposes only, pass `{ "simulateFailure": true }` to force the
confirm to resolve as `failed` instead of `completed`. No real PSP is
involved in either path.

Errors:

- `401 Unauthorized` — missing/invalid access token.
- `404 Not Found` — tip doesn't exist, or belongs to a different fan.
- `409 Conflict` — tip is already `failed` or `cancelled`.

### POST /tips (shorthand)

Runs the intent + confirm flow in a single call, reusing the exact same fee
computation, bounds checks, and idempotency handling as the two-step flow —
it is not a separate insert path. Useful for simple clients that don't need
the two-phase flow.

```bash
curl -X POST http://localhost:3000/tips \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "creatorId": 3, "amountCents": 500 }'
```

`201 Created` — the tip with `status: "completed"` (or `"failed"` if
`simulateFailure: true` was passed).

### GET /tips/me

Fan's own tip history, paginated (`page`, `limit`, optional `status` filter).
Only ever returns tips where `fanId` is the caller — there is no id param to
guess, so isolation is by construction rather than an ownership check.

### GET /creators/me/tips

Creator's own tip inbox, same pagination/filtering, scoped to `creatorId ===`
the caller.

## Audit

`TIP_INTENT_CREATED`, `TIP_CONFIRMED`, and `TIP_FAILED` audit log entries are
written on the corresponding transitions (see `src/audit`).

## Out of scope

- Real PSP charges — this is a stub; `confirm` always succeeds unless
  `simulateFailure` is explicitly passed.
- Tax receipts.
- Outbox/webhook emission — no webhooks module exists yet in this codebase,
  so `tip.created` is not emitted anywhere. Wire it up in `TipsService` once
  one exists.
