import {
  InvalidBillingWebhookSignatureError,
  signBillingWebhookPayload,
  verifyBillingWebhookSignature,
} from './billing-webhook-signature';

describe('billing webhook signature', () => {
  const secret = 'whsec_test_secret';
  const rawBody = Buffer.from(JSON.stringify({ id: 'evt_1', type: 'foo' }));

  it('accepts a correctly signed payload', () => {
    const header = signBillingWebhookPayload(rawBody, secret);
    expect(() =>
      verifyBillingWebhookSignature(rawBody, header, secret),
    ).not.toThrow();
  });

  it('rejects a missing signature header', () => {
    expect(() =>
      verifyBillingWebhookSignature(rawBody, undefined, secret),
    ).toThrow(InvalidBillingWebhookSignatureError);
  });

  it('rejects a malformed signature header', () => {
    expect(() =>
      verifyBillingWebhookSignature(rawBody, 'not-a-valid-header', secret),
    ).toThrow(InvalidBillingWebhookSignatureError);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const header = signBillingWebhookPayload(rawBody, 'a-different-secret');
    expect(() =>
      verifyBillingWebhookSignature(rawBody, header, secret),
    ).toThrow(InvalidBillingWebhookSignatureError);
  });

  it('rejects when the body was tampered with after signing', () => {
    const header = signBillingWebhookPayload(rawBody, secret);
    const tamperedBody = Buffer.from(
      JSON.stringify({ id: 'evt_1', type: 'tampered' }),
    );
    expect(() =>
      verifyBillingWebhookSignature(tamperedBody, header, secret),
    ).toThrow(InvalidBillingWebhookSignatureError);
  });

  it('rejects a signature with an expired timestamp', () => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 10 * 60;
    const header = signBillingWebhookPayload(rawBody, secret, tenMinutesAgo);
    expect(() =>
      verifyBillingWebhookSignature(rawBody, header, secret),
    ).toThrow(InvalidBillingWebhookSignatureError);
  });
});
