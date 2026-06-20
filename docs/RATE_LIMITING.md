# Rate Limiting

## Overview

The API uses [@nestjs/throttler](https://docs.nestjs.com/security/rate-limiting) with a custom `ExtendedThrottlerGuard` that provides env-driven, tiered rate limiting with consistent error responses.

## Tiers

| Tier     | Default Limit | Default TTL | Usage                                      |
|----------|--------------|-------------|--------------------------------------------|
| `auth`   | 5            | 60s         | Signup, login, refresh token               |
| `short`  | 30           | 10s         | Lightweight frequent operations            |
| `medium` | 120          | 60s         | General API endpoints                      |
| `long`   | 3600         | 3600s       | Read-heavy, low-risk endpoints             |
| `exempt` | Unlimited    | —           | Health checks, metrics (`/health`, `/metrics`) |

## Environment Variables

| Variable              | Default  | Description                                           |
|-----------------------|----------|-------------------------------------------------------|
| `THROTTLE_ENABLED`    | `true`   | Set to `false` to disable rate limiting entirely      |
| `THROTTLE_AUTH_TTL`   | `60`     | Auth tier window (seconds)                            |
| `THROTTLE_AUTH_LIMIT` | `5`      | Auth tier max requests per window                     |
| `THROTTLE_SHORT_TTL`  | `10`     | Short tier window (seconds)                           |
| `THROTTLE_SHORT_LIMIT`| `30`     | Short tier max requests per window                    |
| `THROTTLE_MEDIUM_TTL` | `60`     | Medium tier window (seconds)                          |
| `THROTTLE_MEDIUM_LIMIT`| `120`   | Medium tier max requests per window                   |
| `THROTTLE_LONG_TTL`   | `3600`   | Long tier window (seconds)                            |
| `THROTTLE_LONG_LIMIT` | `3600`   | Long tier max requests per window                     |
| `TRUST_PROXY`         | `false`  | Honor `X-Forwarded-For` header when behind a proxy    |
| `REDIS_URL`           | —        | Redis URL for distributed rate limiting (optional)    |

## Key Features

### Tracker Keying
- **Unauthenticated** requests are tracked by IP address.
- **Authenticated** requests are tracked by `userId:ip` combination.
- `X-Forwarded-For` is honored only when `TRUST_PROXY=true`.

### Headers
All rate-limited responses include:
- `X-RateLimit-Limit` — max requests allowed
- `X-RateLimit-Remaining` — requests remaining in the window
- `X-RateLimit-Reset` — timestamp (seconds) when the window resets

On 429 responses, additionally:
- `Retry-After` — seconds to wait before retrying

### Error Format
429 responses follow the application's standard error format via `GlobalExceptionFilter`:

```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later",
  "timestamp": "2026-06-19T12:00:00.000Z",
  "path": "/auth/login",
  "error": "ThrottlerException"
}
```

### Observability
- Warning-level logs are emitted on each rate-limit violation.
- A Prometheus counter `http_rate_limit_exceeded_total` (with label `tier`) is incremented.

## Usage

### Apply a tier decorator

```typescript
import { AuthTier, ShortTier, MediumTier, LongTier, ExemptTier } from '../common/throttle/tiers.decorator';

@Post('login')
@AuthTier()
async login(@Body() loginDto: LoginDto) { ... }

@Get('/public')
@LongTier()
async publicList() { ... }

@Get('health')
@ExemptTier()
async healthCheck() { ... }
```

### Default tier (no decorator)
If no decorator is applied, the first throttler from the config is used (short, then medium, then long — whichever is defined first in the sorted list).

## Architecture

```
throttle.config.ts          → env-driven tier definitions
throttle.module.ts          → ThrottlerModule.forRootAsync + APP_GUARD binding
extended-throttler-guard.ts → ExtendedThrottlerGuard with custom tracker, logging, metrics
tiers.decorator.ts          → @AuthTier(), @ShortTier(), @MediumTier(), @LongTier(), @ExemptTier()
```

The `ExtendedThrottlerGuard` is registered as an `APP_GUARD`, meaning it applies globally. Endpoints with `@ExemptTier()` are skipped via `shouldSkip()`.
