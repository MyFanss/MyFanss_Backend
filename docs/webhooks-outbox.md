# Outbound Webhooks (Outbox)

A transactional outbox for platform events, preparing partner webhook
delivery without pretending real HTTP delivery is done. Events are durable
database rows; a separate dispatcher delivers them with retries and backoff.
There is no real partner-facing signing/delivery client yet — see
[Out of scope](#out-of-scope-today).

All admin routes are documented in Swagger under the **Admin - Webhook
Events** tag at `/api/v1/docs`.

## Data model

`WebhookEvent` (table `webhook_events`):

| Field           | Type      | Notes                                             |
| --------------- | --------- | -------------------------------------------------- |
| `id`            | uuid      | Primary key                                       |
| `eventType`     | varchar   | e.g. `subscription.created`, `post.published`     |
| `payload`       | jsonb     | Redacted before it is ever persisted               |
| `status`        | enum      | `pending` \| `delivered` \| `failed` \| `dead`     |
| `attempts`      | int       | Delivery attempts so far                          |
| `nextAttemptAt` | timestamp | When the dispatcher may next retry this event      |
| `lastError`     | text      | Nullable, set on the most recent failed attempt    |
| `createdAt`     | timestamp | Set on creation                                    |
| `deliveredAt`   | timestamp | Nullable, set once `status` becomes `delivered`    |

Indexed on `(status, nextAttemptAt)`, which is exactly the dispatcher's
selection query.

## Emitters

An event is written by calling `WebhooksService.emit(eventType, payload, manager?)`.
Passing the caller's active `EntityManager` (from `dataSource.transaction(...)`)
makes the outbox insert commit atomically with the domain write — the event
can never be observed without the write it describes, or vice versa.

Wired today:

- `subscription.created` — emitted from `SubscriptionsService.subscribe()`
  (new subscription **and** reactivation of a cancelled one), with
  `subscriptionId`, `fanId`, `creatorId`.
- `post.published` — emitted from `PostsService.createPost()` (posts are
  published immediately on creation in this codebase; there is no separate
  draft state), with `postId`, `creatorId`, `visibility`.

`tip.created` is intentionally not wired: the tips module is present, but
`TipsService` does not run its writes through a shared `DataSource`
transaction the way subscribe/createPost now do, so adding it would mean
emitting outside the domain write's transaction — inconsistent with the
guarantee above. Left as a documented follow-up.

## Payload redaction

Every payload passes through `redactWebhookPayload()`
(`src/webhooks/redact-webhook-payload.util.ts`) before it is saved. Any key
matching `password`, `token`, `secret`, `authorization`, `email`, or
`api[_-]?key` (case-insensitive) is replaced with `"[REDACTED]"`, recursively
through nested objects and arrays. None of the wired emitters currently send
such fields — this is a durable guardrail against a future emitter
accidentally leaking one.

## Dispatcher

There is no cron/interval provider in this stub (no scheduling package is a
dependency of this project). Dispatch is triggered explicitly:

```
POST /api/v1/admin/webhook-events/dispatch
```

Each call processes up to 20 due `pending` events (`nextAttemptAt <= now`),
oldest first. For each event:

- **Sink**: if `WEBHOOK_DEBUG_URL` is set, the event is POSTed there as
  `{ id, eventType, payload }`; a non-2xx response counts as a failure. If
  unset, the event is logged via the app logger and treated as delivered —
  there is no real external delivery target by default.
- **Success** → `status: 'delivered'`, `deliveredAt` set, `lastError` cleared.
- **Failure** → `attempts` incremented; if `attempts` has now reached 5,
  `status: 'dead'`; otherwise `status` stays `pending` and `nextAttemptAt` is
  pushed out by an exponential backoff (`1s * 2^(attempts-1)`, capped at 5
  minutes).

A sink failure only ever mutates the failing event's own row — it cannot roll
back or otherwise affect the domain write that originally emitted the event,
since dispatch always runs as a separate call, after that write already
committed.

## Admin API

All routes require an authenticated admin (`JwtAuthGuard` + `RolesGuard` +
`@Roles(UserRole.ADMIN)`); non-admins get `403`.

- `GET /api/v1/admin/webhook-events?status&page&limit` — paginated list,
  optionally filtered by status.
- `POST /api/v1/admin/webhook-events/dispatch` — runs one dispatch pass now
  (see above); also how tests trigger delivery deterministically instead of
  waiting on a timer.
- `POST /api/v1/admin/webhook-events/:id/retry` — resets a `dead` event back
  to `pending` (`attempts: 0`, `lastError: null`, `nextAttemptAt: now`).
  Returns `409` for any event that isn't currently `dead`.

## Out of scope today

- A multi-tenant endpoint-management UI for creators to register their own
  webhook URLs.
- Signed partner delivery. A real implementation would sign each POST (e.g.
  HMAC-SHA256 over the raw body with a per-partner secret, delivered as a
  header, mirroring `src/billing-webhooks/billing-webhook-signature.ts`) so
  receivers can verify authenticity — not implemented here.
