# Creators API

The Creators module adds a public creator identity on top of the base `User`
record. Every account is a `User`; a `CreatorProfile` is created (1:1) only once
a user **onboards** as a creator. Onboarding upgrades the user's role to
`creator` and persists a public profile used in discovery flows.

All routes are documented in Swagger under the **Creators** tag at `/api`.

## Data model

`CreatorProfile`:

| Field         | Type      | Notes                                          |
| ------------- | --------- | ---------------------------------------------- |
| `id`          | uuid      | Primary key                                    |
| `userId`      | int       | FK → `users.id`, unique (1:1)                  |
| `handle`      | varchar   | Unique, `^[a-z0-9_]{3,30}$`                     |
| `displayName` | varchar   | nullable                                       |
| `bio`         | varchar   | nullable, max 300 chars                         |
| `bannerUrl`   | varchar   | nullable                                       |
| `category`    | varchar   | nullable                                       |
| `isOnboarded` | boolean   | `true` after onboarding                         |
| `createdAt`   | timestamp | Set on creation                                |
| `updatedAt`   | timestamp | Set on update                                  |

### Public vs owner views

- `CreatorResponseDto` (public): `handle`, `displayName`, `bio`, `bannerUrl`,
  `category`, `createdAt`. Never exposes `userId`, email or password.
- `CreatorPrivateDto` (owner): the public fields plus `id`, `userId`,
  `isOnboarded`, `updatedAt`.

## Endpoints

| Method | Path                 | Auth   | Description                          |
| ------ | -------------------- | ------ | ------------------------------------ |
| POST   | `/creators/onboard`  | Bearer | Authenticated user becomes a creator |
| GET    | `/creators/:handle`  | Public | Public profile by handle             |
| PATCH  | `/creators/me`       | Bearer | Owner updates their own profile      |

### POST /creators/onboard

Creates the caller's creator profile and upgrades their role to `creator`.

```bash
curl -X POST http://localhost:3000/creators/onboard \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "jane_doe",
    "displayName": "Jane Doe",
    "bio": "Fitness coach & nutritionist",
    "bannerUrl": "https://cdn.myfans.dev/banners/jane.jpg",
    "category": "fitness"
  }'
```

`201 Created`:

```json
{
  "handle": "jane_doe",
  "displayName": "Jane Doe",
  "bio": "Fitness coach & nutritionist",
  "bannerUrl": "https://cdn.myfans.dev/banners/jane.jpg",
  "category": "fitness",
  "createdAt": "2026-06-20T10:00:00.000Z",
  "id": "0f9b...",
  "userId": 3,
  "isOnboarded": true,
  "updatedAt": "2026-06-20T10:00:00.000Z"
}
```

Errors:

- `400 Bad Request` — handle does not match `^[a-z0-9_]{3,30}$`.
- `401 Unauthorized` — missing/invalid access token.
- `404 Not Found` — authenticated user no longer exists.
- `409 Conflict` — handle already taken, or the user has already onboarded.

### GET /creators/:handle

Public profile lookup. No authentication required and never returns
email/password or internal ids.

```bash
curl http://localhost:3000/creators/jane_doe
```

`200 OK`:

```json
{
  "handle": "jane_doe",
  "displayName": "Jane Doe",
  "bio": "Fitness coach & nutritionist",
  "bannerUrl": "https://cdn.myfans.dev/banners/jane.jpg",
  "category": "fitness",
  "createdAt": "2026-06-20T10:00:00.000Z"
}
```

Errors:

- `404 Not Found` — no creator with that handle.

### PATCH /creators/me

Owner updates their own profile. The handle is immutable. Only the owner can
edit their profile; a caller without a profile gets `404`, and ownership is
enforced server-side (`403` on mismatch).

```bash
curl -X PATCH http://localhost:3000/creators/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Updated bio",
    "bannerUrl": "https://cdn.myfans.dev/banners/jane-v2.jpg"
  }'
```

`200 OK` returns the updated `CreatorPrivateDto`.

Errors:

- `401 Unauthorized` — missing/invalid access token.
- `403 Forbidden` — caller does not own the targeted profile.
- `404 Not Found` — caller has not onboarded as a creator.

## Seeding

`npm run seed:dev` seeds demo users and one creator profile
(`handle: creator_one`) linked to `creator1@dev.local`. Add `--fresh` to reset
the users table first.
