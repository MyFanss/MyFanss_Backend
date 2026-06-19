# Admin Audit Log

## Purpose

The audit log provides an append-only trail of sensitive administrative and security-related actions. It is designed for security review, compliance, and incident investigation.

All audit entries are **immutable** — once written they cannot be updated or deleted via the API.

---

## `AuditLog` Schema

| Field | Type | Description |
|---|---|---|
| `id` | `int` (auto-increment) | Primary key |
| `actorId` | `int \| null` | ID of the user who performed the action (null for anonymous actions like failed login with unknown email) |
| `action` | `varchar(50)` | Action type — see [Actions](#actions) below |
| `targetType` | `varchar(50)` | Entity type acted upon, e.g. `'User'`, `'Subscription'` |
| `targetId` | `int \| null` | ID of the entity acted upon |
| `metadata` | `jsonb \| null` | Contextual data (e.g. `{ before, after }` for role changes) |
| `ipAddress` | `varchar \| null` | IP address of the request originator |
| `createdAt` | `timestamp` | When the entry was created (set on insert, never updatable) |

**Indexes:**
- `createdAt` — for time-range queries
- `action` — for action-type filtering
- `actorId` — for per-actor lookup

---

## Actions

Currently logged actions (defined in `AuditAction` enum):

| Action | Triggered By | Metadata |
|---|---|---|
| `USER_ROLE_CHANGED` | `PATCH /users/:id/role` | `{ before: string, after: string }` |
| `USER_DELETED` | `DELETE /users/:id` | `{ email: string }` |
| `USER_LOGIN_FAILED` | `POST /auth/login` (on invalid credentials) | `{ email: string }` |

### Adding a New Action

1. Add the action value to the `AuditAction` enum in `src/audit/audit-action.enum.ts`:

   ```typescript
   export enum AuditAction {
     // ... existing actions
     SUBSCRIPTION_OVERRIDE = 'SUBSCRIPTION_OVERRIDE',
   }
   ```

2. Call `auditService.log()` from the relevant module:

   ```typescript
   import { AuditService } from '../audit/audit.service';
   import { AuditAction } from '../audit/audit-action.enum';

   // Inside your service:
   this.auditService.log({
     actorId: adminUserId,
     action: AuditAction.SUBSCRIPTION_OVERRIDE,
     targetType: 'Subscription',
     targetId: subscriptionId,
     metadata: { before: 'basic', after: 'premium' },
   });
   ```

3. Ensure the calling module imports `AuditModule`.

---

## Admin Endpoint

### `GET /admin/audit-logs`

**Access:** Admin only (requires both `JwtAuthGuard` and `AdminGuard`)

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `action` | string | No | Filter by action type (e.g. `USER_DELETED`) |
| `actorId` | int | No | Filter by acting user ID |
| `startDate` | ISO 8601 | No | Inclusive start of created-at range |
| `endDate` | ISO 8601 | No | Inclusive end of created-at range |
| `page` | int | No | Page number (default: 1) |
| `limit` | int | No | Results per page (1–100, default: 20) |

**Sample Response (200):**

```json
{
  "data": [
    {
      "id": 1,
      "actorId": 1,
      "action": "USER_ROLE_CHANGED",
      "targetType": "User",
      "targetId": 42,
      "metadata": { "before": "user", "after": "admin" },
      "ipAddress": "192.168.1.1",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "hasMore": false,
    "totalCount": 1,
    "limit": 20
  }
}
```

**Errors:**
- `401 Unauthorized` — missing or invalid JWT
- `403 Forbidden` — user is not an admin

---

## Redaction Policy

The `AuditService.log()` method **always redacts** the following fields from `metadata` before persisting:

- Any key containing `password` (case-insensitive)
- Any key containing `token` (case-insensitive)
- Any key containing `secret` (case-insensitive)
- Any key containing `authorization` (case-insensitive)
- Any key containing `refreshToken` (case-insensitive)
- Any key containing `accessToken` (case-insensitive)
- Any key containing `api_key`, `apiKey`, or similar (case-insensitive)

Redacted values are replaced with the string `'[REDACTED]'`.

**Never persist:** passwords, authentication tokens, refresh tokens, API keys, or raw request bodies under any circumstance.
