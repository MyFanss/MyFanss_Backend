// Deep redaction for outbox payloads. Mirrors AuditService's key-pattern
// approach (see src/audit/audit.service.ts) but walks nested objects/arrays,
// since webhook payloads are free-form jsonb rather than a flat metadata bag,
// and additionally strips emails — partner webhook consumers get ids, not PII.
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /email/i,
  /api[_-]?key/i,
];

const REDACTED = '[REDACTED]';

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
        ? REDACTED
        : redactValue(v);
    }
    return out;
  }

  return value;
}

export function redactWebhookPayload<T extends Record<string, unknown>>(
  payload: T,
): Record<string, unknown> {
  return redactValue(payload) as Record<string, unknown>;
}
