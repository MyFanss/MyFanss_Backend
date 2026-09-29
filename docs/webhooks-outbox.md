# Outbound Webhook Outbox

This document describes the outbound webhook **transactional outbox** stub: durable
platform events, a dispatcher with exponential backoff, admin inspection, and payload
redaction. It prepares partner webhooks without pretending HTTP delivery is done.

> Status: stub. Real signed partner delivery (HMAC) is intentionally out of scope and
documented below as future work.

## Overview

Platform events are persisted to a durable outbox table in the **same DB transaction**
as the domain write whenever feasible. A dispatcher later drains pending rows, applying
exponential backoff on failure and marking rows `dead` after the maximum number of
attempts. Admins can inspect and retry events through a small RBAC-protected API.

## Entity: `WebhookEvent`

| Field           | Type                                              | Notes                                   |
| --------------- | ------------------------------------------------- | --------------------------------------- |
| `id`            | uuid / pk                                         | Idempotency key for processing          |
| `eventType`     | string                                            | e.g. `subscription.created`             |
| `payload`       | jsonb                                             | Redacted event body (no secrets)        |
| `status`        | `pending` \| `delivered` \| `failed` \| `dead`    | Lifecycle state                         |
| `attempts`      | int                                               | Incremented on each dispatch attempt    |
| `nextAttemptAt` | timestamp                                         | Backoff scheduling                      |
| `lastError`     | text (nullable)                                   | Last failure message                    |
| `createdAt`     | timestamp                                         | Row creation time                       |
| `deliveredAt`   | timestamp (nullable)                              | Set when status becomes `delivered`     |

**Index:** `(status, nextAttemptAt)` — used by the dispatcher to select due work.

## Emitters

Emitters write an outbox row inside the same transaction as the domain write when
feasible, so an event is never lost if the process crashes after commit.

| Event                  | Trigger            | Payload fields                          |
| ---------------------- | ------------------ | --------------------------------------- |
| `subscription.created` | on subscribe       | subscription/creator identifiers        |
| `post.published`       | on publish         | `postId`, `creatorId`, `visibility`     |
| `tip.created`          | on tip (optional)  | feature-detected; emitted only if the tips module is present |

Payloads **must not** contain secrets (passwords, refresh tokens, API keys).

## Dispatcher

- Selects `pending` rows whose `nextAttemptAt <= now()`.
- Processing is **idempotent per event id**.
- Dev sink: logs to console, or performs an HTTP stub POST to `WEBHOOK_DEBUG_URL`
  when that env var is set.
- On success: `status = delivered`, `deliveredAt = now()`.
- On failure: `attempts += 1`, `lastError` recorded, `nextAttemptAt` set with
  **exponential backoff**.
- After the maximum attempts: `status = dead`.

### Triggering dispatch

- A cron/interval provider runs the dispatcher periodically in normal operation.
- For tests and manual ops, an explicit endpoint is available:

```
POST /api/v1/admin/webhook-events/dispatch
```

## Admin API

All routes require admin RBAC; non-admins receive `403`.

```
GET  /api/v1/admin/webhook-events?status=&page=&limit=
POST /api/v1/admin/webhook-events/:id/retry   # resets dead -> pending
POST /api/v1/admin/webhook-events/dispatch
```

## Security

- A payload **redaction helper** strips tokens, passwords, and emails that are not
  required for the event before the row is persisted.
- Admin endpoints are RBAC-gated; non-admin callers get `403`.

## Failure isolation

If the dispatcher sink throws, the **domain write still succeeds** and the outbox row
is retained as `pending` for a later attempt. Delivery failures never roll back the
originating domain transaction.

## Testing

Coverage (≥10 cases) includes:

1. Subscribe emits exactly one outbox row.
2. Publish emits `post.published`.
3. Dispatcher success path marks `delivered`.
4. Failure increments `attempts` and schedules backoff.
5. Max attempts transitions the row to `dead`.
6. Admin list enforces RBAC.
7. Payload contains no password / refresh tokens.
8. Domain write still succeeds when the dispatcher sink throws (row stays `pending`).
9. Retry resets `dead` -> `pending`.
10. Dispatcher is idempotent per event id.

## Future work (out of scope)

- Multi-tenant endpoint management UI for creators.
- **Signed partner delivery via HMAC** — payloads will be signed with a per-endpoint
  secret and a timestamped signature header. Not implemented in this stub.
