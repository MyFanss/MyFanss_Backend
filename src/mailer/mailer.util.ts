/** PII-safe masking for logs — keeps first 2 chars of the local part, redacts the rest. */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return '[REDACTED]';
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

// Reset tokens are 64 hex chars (32 random bytes); redact any long hex run defensively.
const SENSITIVE_HEX_PATTERN = /[a-f0-9]{24,}/gi;

export function redactSensitive(value: string): string {
  return value.replace(SENSITIVE_HEX_PATTERN, '[REDACTED]');
}

export function isProductionLike(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
