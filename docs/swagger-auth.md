# Swagger Auth Guide

This document explains how contributors and frontend developers can authenticate
against the MyFans API using Swagger UI.

---

## 1. Open Swagger UI

Start the server locally:

```bash
npm run start:dev
```

Then navigate to:

```
http://localhost:3000/api/v1/docs
```

---

## 2. Obtain an access token

### Option A — via Swagger UI

1. Expand **Authentication → POST /auth/login**.
2. Click **Try it out**.
3. Paste the following into the request body:

```json
{
  "email": "creator1@dev.local",
  "password": "Creator1Pass!"
}
```

4. Click **Execute**.
5. Copy the `accessToken` value from the response body.

> You can use any seeded user from the table in [README.md](../README.md#seeded-users).

### Option B — via curl

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"creator1@dev.local","password":"Creator1Pass!"}' \
  | jq .accessToken
```

---

## 3. Authorize in Swagger UI

1. Click the **Authorize 🔒** button at the top of the Swagger UI page.
2. In the **JWT-auth (http, Bearer)** field, paste the `accessToken` value.
   - Do **not** include the `Bearer ` prefix — Swagger adds it automatically.
3. Click **Authorize**, then **Close**.

All subsequent requests made from Swagger UI will include the
`Authorization: Bearer <token>` header automatically.

---

## 4. Token lifecycle

| Token | Lifetime | Purpose |
|-------|----------|---------|
| `accessToken` | 15 min (default) | Authenticate API requests |
| `refreshToken` | 7 days (default) | Obtain a new access token |

### Refresh an expired access token

```bash
POST /api/v1/auth/refresh

{
  "refreshToken": "<your refresh token>"
}
```

Returns a new `accessToken` + `refreshToken` pair.

### Revoke a session

```bash
# Revoke current session
POST /api/v1/auth/logout
{ "refreshToken": "<token>" }

# Revoke all sessions for your account
POST /api/v1/auth/logout-all
```

---

## 5. Bearer-auth route groups

All routes that require authentication are decorated with `@ApiBearerAuth('JWT-auth')`
and show a **lock icon 🔒** next to the operation in Swagger UI.

Key protected route groups:

| Group | Example endpoints |
|-------|-------------------|
| Users | `GET /users`, `PATCH /users/:id/profile` |
| Posts | `POST /creators/me/posts`, `PATCH /creators/me/posts/:id` |
| Subscriptions | `POST /subscriptions`, `DELETE /subscriptions/:id` |
| Creators | `GET /creators/me/analytics` |
| Auth (session) | `GET /auth/sessions`, `POST /auth/logout` |
| Audit | `GET /audit` (admin only) |

---

## 6. Example: full login → create post flow

```bash
# 1. Log in
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"creator1@dev.local","password":"Creator1Pass!"}' \
  | jq -r .accessToken)

# 2. Create a post
curl -X POST http://localhost:3000/api/v1/creators/me/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My first post",
    "body": "Hello fans!",
    "visibility": "public"
  }'
```

---

## 7. Adding Swagger docs to a new endpoint (contributor guide)

When contributing a new endpoint:

1. Annotate the controller method with `@ApiOperation`, `@ApiResponse`, and if
   protected, `@ApiBearerAuth('JWT-auth')`.
2. Ensure every field in the request/response DTO has `@ApiProperty` or
   `@ApiPropertyOptional` with an `example` value.
3. Verify the schema appears correctly in Swagger UI before opening a PR.

```typescript
// Example — protected endpoint
@Post('me/posts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiOperation({ summary: 'Create a new post as authenticated creator' })
@ApiResponse({ status: 201, type: PostResponseDto })
@ApiResponse({ status: 401, description: 'Unauthorized' })
async createPost(@Body() dto: CreatePostDto) { ... }
```

```typescript
// Example — DTO field
@ApiProperty({
  example: 'My post title',
  description: 'Post title (max 200 characters)',
  maxLength: 200,
})
@IsString()
@MaxLength(200)
title: string;
```
