# RBAC — Role-Based Access Control

## Role Definitions

| Role    | Level | Description                              |
|---------|-------|------------------------------------------|
| fan     | 0     | Default for all new sign-ups             |
| creator | 1     | Content creators; elevated read/write    |
| admin   | 2     | Full platform access; manages roles      |

Roles are stored as a `varchar` column on the `users` table (default `'fan'`).  
The JWT access token payload always includes `role`, so guards never need a DB round-trip.

---

## Decorator Usage

### `@Roles(...roles)`

Restricts a route to one or more exact role values.

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Delete(':id')
deleteUser() {}
```

### `@MinRole(minRole)` (hierarchy check)

Use when a minimum hierarchy level is required instead of an exact match.

```ts
@MinRole(UserRole.CREATOR)
```

### `@Permissions(...perms)`

Fine-grained permission checks resolved from `ROLE_DEFAULT_PERMISSIONS`.

```ts
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(Permission.USERS_WRITE)
```

### `@CurrentUser()`

Injects the authenticated user from `request.user` (set by `JwtStrategy`).

```ts
@Get('me')
getMe(@CurrentUser() user: AuthenticatedRequestUser) {}
```

---

## Guards

| Guard              | Key meta      | Throws on failure              |
|--------------------|---------------|-------------------------------|
| `RolesGuard`       | `roles`       | 403 `INSUFFICIENT_ROLE`        |
| `PermissionsGuard` | `permissions` | 403 `INSUFFICIENT_PERMISSION`  |
| `PoliciesGuard`    | `policies`    | 403 `INSUFFICIENT_ROLE`        |
| `JwtAuthGuard`     | —             | 401 (Passport default)         |

---

## Ownership Policy Pattern

`PoliciesGuard` evaluates named policy strings set via `SetMetadata('policies', [...])`.

| Policy string    | Grants access when                          |
|------------------|---------------------------------------------|
| `user:owner`     | `request.params.id === request.user.userId` |
| `admin:override` | `request.user.role === 'admin'`             |

Combining both policies allows *owner OR admin* access:

```ts
@SetMetadata('policies', ['user:owner', 'admin:override'])
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Put(':id')
updateUser() {}
```

The `UsersController` handles ownership inline using `@CurrentUser()`:

```ts
const isOwner = currentUser?.userId === id;
const isAdmin = currentUser?.role === UserRole.ADMIN;
if (!isOwner && !isAdmin) throw new ForbiddenException({ code: 'INSUFFICIENT_ROLE' });
```

---

## Protecting New Controllers

1. Add `@ApiBearerAuth('JWT-auth')` at controller level for Swagger.
2. Apply `@UseGuards(JwtAuthGuard, RolesGuard)` at controller or handler level.
3. Use `@Roles(UserRole.ADMIN)` for admin-only routes.
4. Inject `@CurrentUser()` where ownership logic is needed.
5. Use `@ApiForbiddenResponse({ description: 'Insufficient role' })` on each protected endpoint.

```ts
@ApiTags('Things')
@ApiBearerAuth('JWT-auth')
@Controller('things')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ThingsController {
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  findAll() {}
}
```

---

## Role Assignment

Only admins may assign roles via `PATCH /admin/users/:id/role`.  
The last admin cannot demote themselves — the endpoint returns `403 LAST_ADMIN_PROTECTION`.

Role changes are audit-logged:

```
Role changed: actorId=<actor> targetId=<target> oldRole=<old> newRole=<new>
```

---

## Error Codes

| HTTP | Code                       | Meaning                          |
|------|----------------------------|----------------------------------|
| 401  | (no code / Passport)       | Missing or invalid JWT           |
| 403  | `INSUFFICIENT_ROLE`        | Role/policy check failed         |
| 403  | `INSUFFICIENT_PERMISSION`  | Permission check failed          |
| 403  | `LAST_ADMIN_PROTECTION`    | Cannot demote the last admin     |
