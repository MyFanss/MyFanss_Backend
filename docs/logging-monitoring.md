# Logging & Monitoring in MyFanss Backend

## Logging

- Uses Winston via `AppLogger` service (see `src/logger/app-logger.service.ts`).
- Log levels: info, warn, error, debug.
- Context: timestamps, class/method, request info (where available).
- Format: JSON in production, human-readable in development.
- Usage:
  ```typescript
  import { AppLogger } from '../logger/app-logger.service';
  // ...
  constructor(private readonly logger: AppLogger) {}
  this.logger.log('message', 'Context');
  this.logger.error('error', 'stack', 'Context');
  ```
- GlobalExceptionFilter logs all errors.
- No sensitive data should be logged.

## Monitoring

- Prometheus metrics exposed at `/metrics` (see `src/monitoring/monitoring.module.ts`).
- Health checks (optional) at `/health` (see `src/monitoring/health.module.ts`).
- Metrics include request count, duration, error rates, uptime, memory usage.

## Configuration

- Log level and format are environment-based (`NODE_ENV`).
- Logging can be filtered by changing Winston config in `app-logger.service.ts`.

## Example

See `AppController` for logger usage example.

## Extending

- Use `AppLogger` in any service/controller for consistent logging.
- Add custom metrics using Prometheus decorators if needed.

---
For questions, contact the backend team.
