import { redactWebhookPayload } from './redact-webhook-payload.util';

describe('redactWebhookPayload', () => {
  it('redacts top-level password/token/secret/email fields', () => {
    const redacted = redactWebhookPayload({
      password: 'hunter2',
      refreshToken: 'abc.def',
      apiKey: 'sk_live_123',
      email: 'fan@example.com',
      postId: 42,
    });

    expect(redacted).toEqual({
      password: '[REDACTED]',
      refreshToken: '[REDACTED]',
      apiKey: '[REDACTED]',
      email: '[REDACTED]',
      postId: 42,
    });
  });

  it('redacts sensitive keys inside nested objects', () => {
    const redacted = redactWebhookPayload({
      creator: { id: 1, email: 'creator@example.com' },
    });

    expect(redacted).toEqual({ creator: { id: 1, email: '[REDACTED]' } });
  });

  it('redacts sensitive keys inside arrays of objects', () => {
    const redacted = redactWebhookPayload({
      subscribers: [{ fanId: 1, authorization: 'Bearer xyz' }],
    });

    expect(redacted).toEqual({
      subscribers: [{ fanId: 1, authorization: '[REDACTED]' }],
    });
  });

  it('leaves non-sensitive fields untouched', () => {
    const redacted = redactWebhookPayload({
      subscriptionId: 'uuid-1',
      fanId: 1,
      creatorId: 2,
    });

    expect(redacted).toEqual({
      subscriptionId: 'uuid-1',
      fanId: 1,
      creatorId: 2,
    });
  });
});
