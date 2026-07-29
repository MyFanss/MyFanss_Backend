import * as crypto from 'crypto';

// Stripe-style signature header: "t=<unix seconds>,v1=<hex hmac-sha256>"
// The HMAC is computed over "<timestamp>.<raw body>" using the shared secret.
const SIGNED_PAYLOAD_SEPARATOR = '.';
const TOLERANCE_SECONDS = 5 * 60;

export class InvalidBillingWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBillingWebhookSignatureError';
  }
}

export function signBillingWebhookPayload(
  rawBody: string | Buffer,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): string {
  const signedPayload = `${timestamp}${SIGNED_PAYLOAD_SEPARATOR}${rawBody.toString()}`;
  const digest = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

/**
 * Verifies a raw request body against a Stripe-style signature header.
 * Throws InvalidBillingWebhookSignatureError when the header is malformed,
 * mismatched, or expired. Callers must invoke this before parsing/acting on
 * the body.
 */
export function verifyBillingWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): void {
  if (!signatureHeader) {
    throw new InvalidBillingWebhookSignatureError(
      'Missing billing webhook signature header',
    );
  }

  const parts = new Map<string, string>();
  for (const segment of signatureHeader.split(',')) {
    const [key, value] = segment.split('=');
    if (key && value) parts.set(key.trim(), value.trim());
  }

  const timestamp = parts.get('t');
  const providedSignature = parts.get('v1');
  if (!timestamp || !providedSignature) {
    throw new InvalidBillingWebhookSignatureError(
      'Malformed billing webhook signature header',
    );
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > TOLERANCE_SECONDS) {
    throw new InvalidBillingWebhookSignatureError(
      'Billing webhook signature timestamp outside tolerance',
    );
  }

  const signedPayload = `${timestamp}${SIGNED_PAYLOAD_SEPARATOR}${rawBody.toString()}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const providedBuffer = Buffer.from(providedSignature, 'hex');

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new InvalidBillingWebhookSignatureError(
      'Billing webhook signature mismatch',
    );
  }
}
