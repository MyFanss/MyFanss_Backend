Issue:Description
Task: Add Health Readiness Probes and GDPR Self-Service Export
Overview
Health module needs live/ready probes for ops, and users need self-service data export/delete for GDPR-style compliance.

Goals
GET /api/v1/health/live — process up (200)
GET /api/v1/health/ready — PostgreSQL check via Terminus (503 if down)
GET /api/v1/users/me/export — JSON of profile, preferences, subscriptions (no password hash)
DELETE /api/v1/users/me — soft delete + revoke sessions
Deliverables
Health controller (rate-limit exempt)
GDPR/export service + audit on self-delete
Integration tests for ready probe + export
Acceptance Criteria
/health/ready returns 503 when DB unreachable (mocked)
/health/live returns 200 without DB check
Export excludes password hashes/tokens
Self-delete soft-deletes user, revokes refresh tokens, returns 204
Deleted user cannot authenticate
At least 8 tests