# Direct Messaging API

A minimal, production-shaped DM layer between fans and creators: unique
conversations, cursor-paginated messages, read receipts, and a per-user rate
limit. All routes are documented in Swagger under the **Messaging** tag.

## Data model

`Conversation`:

| Field                | Type      | Notes                                        |
| -------------------- | --------- | --------------------------------------------- |
| `id`                 | int       | Primary key                                    |
| `fanId`               | int       | FK → `users.id`, `ON DELETE CASCADE`           |
| `creatorId`           | int       | FK → `users.id`, `ON DELETE CASCADE`           |
| `lastMessageAt`       | timestamp | Set at creation, bumped on every new message   |
| `lastMessagePreview`  | varchar(160) | First 140 chars of the latest message, nullable |
| `createdAt`/`updatedAt` | timestamp | Standard bookkeeping                         |

Unique constraint on `(fanId, creatorId)` — a fan/creator pair can only ever
have one conversation. Indexed on `(fanId, lastMessageAt)` and
`(creatorId, lastMessageAt)` for inbox queries.

`Message`:

| Field            | Type      | Notes                                                    |
| ---------------- | --------- | --------------------------------------------------------- |
| `id`             | int       | Primary key                                                |
| `conversationId` | int       | FK → `conversations.id`, `ON DELETE CASCADE`               |
| `senderId`       | int       | FK → `users.id`, `ON DELETE CASCADE`                       |
| `body`           | text      | 1–2000 chars, trimmed; whitespace-only bodies are rejected |
| `clientId`       | varchar(100) | Optional idempotency key, nullable                       |
| `createdAt`      | timestamp | Set on creation                                            |
| `readAt`         | timestamp | Nullable — set when the recipient marks it read            |

Partial unique index on `(conversationId, senderId, clientId) WHERE clientId
IS NOT NULL` backs idempotent sends.

## Endpoints

| Method | Path                            | Notes                                             |
| ------ | -------------------------------- | -------------------------------------------------- |
| POST   | `/conversations`                 | Fan-only. Get-or-create by `(fanId, creatorId)`.   |
| GET    | `/conversations/me`              | Inbox for the caller, `lastMessageAt` DESC.        |
| GET    | `/conversations/:id/messages`    | Oldest → newest, cursor-paginated.                 |
| POST   | `/conversations/:id/messages`    | Participant only. Rate-limited. Idempotent.        |
| POST   | `/conversations/:id/read`        | Participant only. Marks the other side's messages read. |

## Rules

### Only fans initiate; creators reply

`POST /conversations` is guarded with `@Roles(UserRole.FAN)`. A creator
calling it gets `403`. This keeps the "fan reaches out first" product shape
explicit rather than implicit — creators can freely reply once a fan has
opened the thread, but can't cold-message fans through this endpoint.

### 404 vs 403 policy

For any endpoint scoped to `:id` (messages, read), the conversation is looked
up first:

- Conversation doesn't exist at all → **404**.
- Conversation exists but the caller is neither `fanId` nor `creatorId` →
  **403**.

This does technically confirm a conversation ID exists to a non-participant
(via the 403 vs 404 distinction), which is the explicit trade-off called out
in the spec. We accept it here because conversation IDs are not
guessable-sensitive on their own (no content is exposed, only participation
existence), and a `403` gives callers a clear, actionable signal instead of
an ambiguous `404`. If stricter ID-existence hiding is ever required, switch
the non-participant branch to `404` as well — the two code paths are
isolated in `MessagingService.getParticipantConversation`.

### Idempotent sends

`POST /conversations/:id/messages` accepts either a `clientId` field in the
body or an `Idempotency-Key` header (the header is copied into `clientId` if
the body didn't set one). Resending the same key for the same
conversation/sender pair returns the original message (still `201`, since
the request as issued was newly persisted from the caller's point of view)
instead of creating a duplicate row. A race between two identical concurrent
sends is resolved via the partial unique index — the loser catches the
Postgres `23505` unique-violation and re-reads the winning row.

### Read receipts

`POST /conversations/:id/read` marks messages sent by the **other**
participant as read, up to a given `messageId` or `readAt` timestamp (or
"now" if neither is given). A caller can never mark their own messages read
through this endpoint.

### Rate limiting

`MessageRateLimitGuard` is an in-memory (cache-manager backed) token-bucket
stub, keyed per `senderId` across all conversations (20 sends / 60s window),
so a user can't dodge the limit by spreading sends across threads. This
mirrors the existing `CommentRateLimitGuard` pattern used by the comments
module — swap in a real distributed limiter (Redis, etc.) before relying on
this in a multi-instance deployment.

### Soft-deleted users

Both the recipient and the sender are checked against `users.is_deleted` on
every send. A soft-deleted recipient causes `403` ("no longer available").
Soft-deleted users also can't initiate conversations.

## Pagination

Both list endpoints use opaque, base64-encoded keyset cursors (no offsets):

- **Messages**: cursor encodes the last message `id` seen; next page is
  `id > cursor.id`, ordered ascending — so pages read oldest → newest and
  stay stable even as new messages arrive concurrently.
- **Inbox**: cursor encodes `(lastMessageAt, id)` of the last row seen; next
  page is a standard keyset comparison ordered `lastMessageAt DESC, id DESC`.

## Testing

See `test/messaging.e2e-spec.ts` (integration-style, real Postgres via
TypeORM `synchronize: true`, same harness as `comments.e2e-spec.ts`) and
`src/messaging/guards/message-rate-limit.guard.spec.ts` (unit test for the
rate limiter, including a rate-limit-trip case).
