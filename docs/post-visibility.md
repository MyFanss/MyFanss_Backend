# Post Visibility

Decision record for who can see a creator's posts, and how handle-based
routing works. This governs `GET /creators/:handle/posts` and
`GET /creators/:handle/posts/:postId` — the only two read paths that expose
posts across tenant boundaries. `GET /creators/me/posts` (owner's own list)
is unfiltered by design: an owner always sees all their own non-deleted
posts.

## Handle resolution

- Creators are resolved **strictly by the `handle` string column** via
  `CreatorsService.getByHandle` / `CreatorsService.getCreatorUserIdByHandle`.
  No code path treats `:handle` as a primary key, numeric user id, or
  `CreatorProfile.id` (a UUID) — a handle that happens to look like either
  (all-digits, or UUID-shaped with hyphens) is just looked up by the
  `handle` column like any other string, and 404s like any other unknown
  value if it isn't one.
- Handles are canonicalized to lowercase on write (onboarding) and on read
  (trim + lowercase before lookup), so `Creator_One`, `creator_one` and
  `  creator_one  ` all resolve to the same profile.
- A handle resolves to a usable creator only if **all** of the following
  hold; otherwise the request gets a uniform `404 { code: 'CREATOR_NOT_FOUND' }`:
  - the `handle` format is valid (`^[a-z0-9_]{3,30}$`),
  - a `CreatorProfile` exists with that handle,
  - `CreatorProfile.isOnboarded` is `true`,
  - the owning `User.is_deleted` is `false`.

  These are deliberately collapsed into one status code and one error code.
  Distinguishing "malformed handle" from "doesn't exist" from "exists but
  the account was deleted" via different status codes would let a caller
  enumerate which of those is true for a given handle — an existence
  oracle. Malformed-handle format validation still returns a distinct `400`
  on the **write** path (`POST /creators/onboard`), where it's ordinary
  input validation on data the caller is submitting, not a lookup.

## Visibility matrix

| Post visibility | Anonymous | Authenticated, not subscribed | Active subscriber | Owner |
| ---------------- | :-------: | :----------------------------: | :----------------: | :---: |
| `public`          | ✅        | ✅                              | ✅                  | ✅    |
| `subscribers`     | ❌        | ❌                              | ✅                  | ✅    |

- `private` / `draft`: **N/A** — the `Post` entity only models
  `'public' | 'subscribers'` visibility in this codebase. If those states
  are added later, they should be owner-only and slot into this same
  decision table (and the same central service) rather than a new
  parallel check.
- Subscription status: `SubscriptionStatus` is only `'active' | 'cancelled'`
  in this schema (no `expired` / `past_due`). Only `status === 'active'`
  unlocks subscriber content — a cancelled row never does, regardless of
  when it was cancelled. If billing-driven statuses (`expired`,
  `past_due`) are introduced, the intended rule is the same: only `active`
  unlocks content unless a product decision explicitly says otherwise.
- Soft-deleted posts (`deletedAt IS NOT NULL`) are excluded from every read
  path — list, detail, and the owner's own `me/posts` list. Posts are never
  hard-deleted, so ids referenced elsewhere (e.g. `content_reports.targetId`)
  stay resolvable for moderation/audit purposes even after deletion.

## Central enforcement

All of the above is implemented once, in `PostVisibilityService`
(`src/posts/post-visibility.service.ts`), and consumed by both the list and
detail read paths in `PostsService`. Neither the controller nor the service
duplicates an `if (visibility === ...)` check anywhere else — a new post
read endpoint should call this service rather than re-implement the matrix.

```
PostsController (optional-auth JWT)
  -> PostsService.getPostsByHandle / getPostByHandle
       -> CreatorsService.getCreatorUserIdByHandle(handle)   // resolution
       -> PostVisibilityService.canView*(...)                // policy
       -> postsRepo query filtered by deletedAt / visibility  // data
```

## Optional authentication

Both read endpoints use `OptionalJwtAuthGuard` instead of `JwtAuthGuard`:

- No `Authorization` header, or an invalid/expired token → the request
  proceeds as anonymous (`req.user` is `undefined`); only `public` posts are
  returned/visible.
- A valid token → `req.user` is populated and evaluated against the owner
  and active-subscriber paths in addition to `public`.

This guard never throws — a bad token degrades to "anonymous", it does not
401 a public endpoint.

## 404 vs 403 for unauthorized subscriber content

`GET /creators/:handle/posts/:postId` returns a plain `404 Not Found` — not
`403 Forbidden` — whenever the post doesn't exist, is soft-deleted, or
exists but the caller isn't authorized to view it (not the owner, not an
active subscriber). This is intentional: a distinct `403` would confirm to
an unauthorized caller that a specific subscriber-only post id exists for
that creator, which is itself information disclosure. Uniform `404` gives
no signal either way. The response body in all of these cases is a generic
"Post not found" message — the post's `title`, `body` and `mediaUrl` are
never included in an error payload.

## Performance: avoiding N+1 subscription checks

Visibility is a property of the **(viewer, creator)** pair, not of any
individual post. Both `getPostsByHandle` (list) and `getPostByHandle`
(detail) call `PostVisibilityService` — and therefore
`SubscriptionsService.isActiveSubscriber` — **exactly once per request**,
before querying/filtering posts, regardless of how many posts are on the
page. The subscription check itself is a single indexed lookup
(`subscriptions` has a unique index on `(fanId, creatorId)`), not a table
scan or a per-post join.

## Indexes

`posts` has a composite index on `(creatorId, deletedAt, publishedAt)`
(migration `1785100000000-AddDeletedAtToPosts`), matching the list query's
shape: filter by `creatorId` + `deletedAt IS NULL`, sort by `publishedAt`.
The existing `(creatorId, visibility)` index continues to serve the
visibility filter added on top for non-owner/non-subscriber callers.
