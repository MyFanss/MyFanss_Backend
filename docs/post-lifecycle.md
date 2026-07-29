# Post Lifecycle: Soft-Delete, Archive, Restore

## Why

Posts used to be **hard-deleted** (`DELETE /creators/me/posts/:id` removed the
row). Users are soft-deleted (`User.is_deleted`); posts now follow the same
pattern so creators can recover accidental deletions and so dependent
engagement (likes/comments, once built) has a stable target to reason about.

There is **no hard-delete path via the creator API**. Deleted posts remain in
the database indefinitely (see [Out of scope](#out-of-scope)).

## Data model

`Post` gains two nullable columns (migration
`src/migrations/1790000000000-AddPostSoftDelete.ts`):

| Field         | Type             | Notes                                            |
| ------------- | ---------------- | ------------------------------------------------- |
| `deletedAt`   | `timestamp \| null` | Set on soft-delete, cleared on restore. `null` = active. |
| `deletedById` | `int \| null`       | Who deleted it. FK → `users.id`, `ON DELETE SET NULL`.   |

Pre-existing rows are backfilled with `deletedAt = NULL` (i.e. unaffected).

### Indexes

Every active-post read path filters `deletedAt IS NULL`, so the original
`(creatorId, publishedAt)` and `(visibility, publishedAt)` indexes were
replaced with **partial indexes** scoped to `WHERE "deletedAt" IS NULL`
(`IDX_posts_creator_published_active`,
`IDX_posts_visibility_published_active`). A plain
`(creatorId, deletedAt)` index (`IDX_posts_creator_deletedAt`) backs the
archive listing, which filters `deletedAt IS NOT NULL`.

## Endpoints

| Method | Path                                | Auth   | Behavior |
| ------ | ----------------------------------- | ------ | -------- |
| DELETE | `/creators/me/posts/:id`            | Bearer | Soft-delete: sets `deletedAt`/`deletedById`, returns `204`. |
| GET    | `/creators/me/posts/archived`       | Bearer | Paginated list of the caller's soft-deleted posts. |
| POST   | `/creators/me/posts/:id/restore`    | Bearer | Clears `deletedAt`/`deletedById`, returns the restored post (`200`). |

No purge/hard-delete endpoint exists. If a legal or compliance need for
permanent erasure arises, it should be handled by the GDPR export/wipe flow
(see `src/users/services/gdpr.service.ts`), not this API — media-binary legal
holds are explicitly out of scope here.

## Read-path filtering

All of these exclude soft-deleted posts (`deletedAt IS NULL`):

- `GET /creators/me/posts` — owner's active list (deleted posts move to the
  archive endpoint instead).
- `GET /creators/:handle/posts` — public/subscriber-aware creator feed.
- `PostsService.getPostById` — single-post lookup (not yet wired to a route,
  but any future route must use it or `assertPostIsEngageable` rather than
  querying `Post` directly).

`GET /creators/me/posts/archived` is the only read path that returns
soft-deleted posts, and only to the owner.

## Authorization

- **Delete/restore:** only the post's `creatorId` may act on it.
  - Wrong owner → `403 Forbidden`.
  - Post doesn't exist at all (any state) → `404 Not Found`.
  - No admin override exists yet; add one deliberately (with its own audit
    action) if/when moderation needs to force-delete a post.

## Idempotency

- **Delete an already-deleted post:** `204 No-op`. The service checks
  `post.deletedAt` first and returns without touching the row or emitting an
  audit event, so double-clicking "delete" is safe.
- **Restore a post that isn't deleted:** `409 Conflict`. This was a
  deliberate choice over a silent no-op — restoring implies a specific
  soft-deleted state existed, and returning `409` gives the client explicit
  feedback that nothing needed restoring, rather than masking a
  possible client-side bug (e.g. restoring the wrong id).

## Engagement (likes/comments) on deleted posts

Likes and comments don't exist yet in this codebase. The contract any future
implementation **must** follow:

- **New engagement on a deleted (or missing) post → `404 Not Found`.**
  `PostsService.assertPostIsEngageable(postId)` is the enforcement point:
  it does the same `deletedAt IS NULL` lookup as `getPostById` and throws
  `NotFoundException` otherwise. Future `LikesService`/`CommentsService`
  implementations should call it before writing a like/comment, instead of
  querying `Post` directly.
- **Existing engagement on a post that gets deleted → hidden implicitly.**
  Because the post itself disappears from every public/owner-active read
  path, any comments/likes attached to it become unreachable through normal
  navigation. There is no separate "tombstone" placeholder shown in feeds —
  the post is simply absent, exactly like any other soft-deleted post. If a
  future UI needs to show "this post was removed" inline (e.g. a reply in a
  thread pointing at a deleted parent), that tombstone rendering is a
  client/API-shape concern for whichever feature introduces threaded
  replies, not something this issue's scope requires stubbing out.

### Known related limitation (documented, not fixed here)

`ModerationService.assertTargetExists` (content reports) still looks up
posts without a `deletedAt` filter, so a post can technically still be
*reported* after it's been soft-deleted. This is unchanged by this work —
moderation's target-existence check is out of scope for this issue — but is
worth revisiting alongside a future moderation change, since reporting a
post a creator already deleted is low-value.

## Audit

Two new `AuditAction` values (`src/audit/audit-action.enum.ts`):

- `POST_SOFT_DELETED` — logged on every non-idempotent delete, `targetType:
  'Post'`, `targetId: <postId>`, `actorId: <creatorId>`.
- `POST_RESTORED` — logged on every successful restore, same shape.

No-op deletes and failed restores (403/404/409) do **not** emit an audit
entry — only state transitions are logged, consistent with the rest of the
audit log (see `docs/audit-log.md`).

## Out of scope

- Legal hold / GDPR wipe of media binaries — see the GDPR export flow
  instead.
- Admin-only hard purge — no endpoint exists; if retention policy requires
  one later, add it as a separate admin-guarded route with its own audit
  action, not a variant of the creator-facing delete.
