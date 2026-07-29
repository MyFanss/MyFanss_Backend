/**
 * Integration tests for the billing webhook pipeline (signature
 * verification, idempotent event store, transactional subscription
 * mutations) against a real PostgreSQL database.
 */
import * as request from 'supertest';
import { randomUUID as uuid } from 'crypto';
import {
  IntegrationApp,
  clearAll,
  createIntegrationApp,
  teardownIntegrationApp,
} from './setup';
import { signBillingWebhookPayload } from '../../src/billing-webhooks/billing-webhook-signature';

const PASSWORD = 'Password123!';
const WEBHOOK_SECRET = 'whsec_integration_test_secret';

describe('Billing Webhooks (integration)', () => {
  let ctx: IntegrationApp;
  let fanId: number;
  let creatorId: number;

  beforeAll(async () => {
    process.env.BILLING_WEBHOOK_SECRET = WEBHOOK_SECRET;
    ctx = await createIntegrationApp();
  }, 90_000);

  afterAll(async () => {
    delete process.env.BILLING_WEBHOOK_SECRET;
    await teardownIntegrationApp(ctx);
  }, 30_000);

  beforeEach(async () => {
    await clearAll(ctx.dataSource);
    await ctx.dataSource.query(
      'TRUNCATE TABLE "billing_webhook_events" RESTART IDENTITY CASCADE',
    );
    await ctx.dataSource.query(
      'TRUNCATE TABLE "billing_customer_maps" RESTART IDENTITY CASCADE',
    );
    await ctx.dataSource.query(
      'TRUNCATE TABLE "subscriptions" RESTART IDENTITY CASCADE',
    );
    await ctx.dataSource.query(
      'TRUNCATE TABLE "audit_logs" RESTART IDENTITY CASCADE',
    );

    await request(ctx.app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Fan', email: 'fan@test.com', password: PASSWORD });
    await request(ctx.app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Creator', email: 'creator@test.com', password: PASSWORD });

    fanId = (await ctx.userRepo.findOne({ where: { email: 'fan@test.com' } }))!
      .id;
    creatorId = (await ctx.userRepo.findOne({
      where: { email: 'creator@test.com' },
    }))!.id;
  });

  function post(rawBody: string, signature?: string) {
    const req = request(ctx.app.getHttpServer())
      .post('/api/v1/webhooks/billing')
      .set('Content-Type', 'application/json');
    if (signature) req.set('stripe-signature', signature);
    return req.send(rawBody);
  }

  function signedPost(payload: unknown) {
    const rawBody = JSON.stringify(payload);
    const signature = signBillingWebhookPayload(rawBody, WEBHOOK_SECRET);
    return request(ctx.app.getHttpServer())
      .post('/api/v1/webhooks/billing')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(rawBody);
  }

  async function getEventRow(eventId: string) {
    const rows = await ctx.dataSource.query(
      'SELECT * FROM "billing_webhook_events" WHERE "eventId" = $1',
      [eventId],
    );
    return rows[0];
  }

  it('activates a subscription on subscription.activated and creates the customer map', async () => {
    const eventId = uuid();
    const externalSubscriptionId = uuid();

    const res = await signedPost({
      id: eventId,
      type: 'subscription.activated',
      data: {
        customerId: 'cus_1',
        subscriptionId: externalSubscriptionId,
        fanId,
        creatorId,
      },
    }).expect(200);

    expect(res.body.data.status).toBe('processed');

    const subscription = await ctx.dataSource.query(
      'SELECT * FROM "subscriptions" WHERE "fanId" = $1 AND "creatorId" = $2',
      [fanId, creatorId],
    );
    expect(subscription).toHaveLength(1);
    expect(subscription[0].status).toBe('active');

    const map = await ctx.dataSource.query(
      'SELECT * FROM "billing_customer_maps" WHERE "externalSubscriptionId" = $1',
      [externalSubscriptionId],
    );
    expect(map).toHaveLength(1);
  });

  it('cancels a subscription on subscription.cancelled and retains history', async () => {
    const externalSubscriptionId = uuid();
    await signedPost({
      id: uuid(),
      type: 'subscription.activated',
      data: {
        customerId: 'cus_1',
        subscriptionId: externalSubscriptionId,
        fanId,
        creatorId,
      },
    }).expect(200);

    const res = await signedPost({
      id: uuid(),
      type: 'subscription.cancelled',
      data: { customerId: 'cus_1', subscriptionId: externalSubscriptionId },
    }).expect(200);

    expect(res.body.data.status).toBe('processed');

    const subscription = await ctx.dataSource.query(
      'SELECT * FROM "subscriptions" WHERE "fanId" = $1 AND "creatorId" = $2',
      [fanId, creatorId],
    );
    expect(subscription[0].status).toBe('cancelled');
    expect(subscription[0].cancelledAt).not.toBeNull();
  });

  it('marks the subscription past_due on payment.failed without deleting it', async () => {
    const externalSubscriptionId = uuid();
    await signedPost({
      id: uuid(),
      type: 'subscription.activated',
      data: {
        customerId: 'cus_1',
        subscriptionId: externalSubscriptionId,
        fanId,
        creatorId,
      },
    }).expect(200);

    const res = await signedPost({
      id: uuid(),
      type: 'payment.failed',
      data: { customerId: 'cus_1', subscriptionId: externalSubscriptionId },
    }).expect(200);

    expect(res.body.data.status).toBe('processed');

    const subscription = await ctx.dataSource.query(
      'SELECT * FROM "subscriptions" WHERE "fanId" = $1 AND "creatorId" = $2',
      [fanId, creatorId],
    );
    expect(subscription).toHaveLength(1);
    expect(subscription[0].status).toBe('past_due');
  });

  it('is idempotent on replay: duplicate eventId returns 200 no-op with the recorded outcome', async () => {
    const eventId = uuid();
    const payload = {
      id: eventId,
      type: 'subscription.activated',
      data: { customerId: 'cus_1', subscriptionId: uuid(), fanId, creatorId },
    };

    const first = await signedPost(payload).expect(200);
    const second = await signedPost(payload).expect(200);

    expect(first.body.data.status).toBe('processed');
    expect(second.body.data.status).toBe('processed');
    expect(second.body.data.duplicate).toBe(true);

    const events = await ctx.dataSource.query(
      'SELECT * FROM "billing_webhook_events" WHERE "eventId" = $1',
      [eventId],
    );
    expect(events).toHaveLength(1);
    expect(events[0].deliveryAttempts).toBe(1);
  });

  it('rejects an invalid signature with 401 when a secret is configured', async () => {
    const payload = { id: uuid(), type: 'subscription.activated', data: {} };
    await post(JSON.stringify(payload), 't=1,v1=deadbeef').expect(401);
  });

  it('rejects a missing signature with 401 when a secret is configured', async () => {
    const payload = { id: uuid(), type: 'subscription.activated', data: {} };
    await post(JSON.stringify(payload)).expect(401);
  });

  it('stores an unknown event type as ignored and returns 200', async () => {
    const eventId = uuid();
    const res = await signedPost({
      id: eventId,
      type: 'invoice.upcoming',
      data: {},
    }).expect(200);

    expect(res.body.data.status).toBe('ignored');

    const row = await getEventRow(eventId);
    expect(row.status).toBe('ignored');
  });

  it('fails with an actionable error when the external subscription has no customer mapping', async () => {
    const eventId = uuid();
    const res = await signedPost({
      id: eventId,
      type: 'subscription.cancelled',
      data: {
        customerId: 'cus_unknown',
        subscriptionId: 'sub_never_activated',
      },
    }).expect(200);

    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.error).toMatch(/no BillingCustomerMap found/i);

    const row = await getEventRow(eventId);
    expect(row.status).toBe('failed');
  });

  it('handles concurrent duplicate delivery via the eventId unique constraint', async () => {
    const eventId = uuid();
    const payload = {
      id: eventId,
      type: 'subscription.activated',
      data: { customerId: 'cus_1', subscriptionId: uuid(), fanId, creatorId },
    };

    const [first, second] = await Promise.all([
      signedPost(payload),
      signedPost(payload),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const events = await ctx.dataSource.query(
      'SELECT * FROM "billing_webhook_events" WHERE "eventId" = $1',
      [eventId],
    );
    expect(events).toHaveLength(1);

    const subscriptions = await ctx.dataSource.query(
      'SELECT * FROM "subscriptions" WHERE "fanId" = $1 AND "creatorId" = $2',
      [fanId, creatorId],
    );
    expect(subscriptions).toHaveLength(1);
  });

  it('leaves a consistent failed event status and no orphan subscription row when the mutation violates a DB constraint', async () => {
    const eventId = uuid();
    const nonExistentFanId = 999999;

    const res = await signedPost({
      id: eventId,
      type: 'subscription.activated',
      data: {
        customerId: 'cus_bad',
        subscriptionId: uuid(),
        fanId: nonExistentFanId,
        creatorId,
      },
    }).expect(200);

    expect(res.body.data.status).toBe('failed');

    const row = await getEventRow(eventId);
    expect(row.status).toBe('failed');
    expect(row.error).toBeTruthy();

    const subscriptions = await ctx.dataSource.query(
      'SELECT * FROM "subscriptions" WHERE "fanId" = $1',
      [nonExistentFanId],
    );
    expect(subscriptions).toHaveLength(0);

    // The event row itself must have committed despite the mutation
    // failing, otherwise a genuine redelivery would reprocess and
    // double-attempt the same broken mutation instead of short-circuiting.
    const replay = await signedPost({
      id: eventId,
      type: 'subscription.activated',
      data: {
        customerId: 'cus_bad',
        subscriptionId: uuid(),
        fanId: nonExistentFanId,
        creatorId,
      },
    }).expect(200);
    expect(replay.body.data.duplicate).toBe(true);
  });

  it('rejects a payload larger than the configured max size', async () => {
    const rawBody = JSON.stringify({
      id: uuid(),
      type: 'subscription.activated',
      data: { padding: 'x'.repeat(80 * 1024) },
    });
    const signature = signBillingWebhookPayload(rawBody, WEBHOOK_SECRET);
    await post(rawBody, signature).expect(413);
  });

  describe('GET /api/v1/admin/billing/webhook-events', () => {
    it('lists recorded events for an admin', async () => {
      await signedPost({
        id: uuid(),
        type: 'subscription.activated',
        data: { customerId: 'cus_1', subscriptionId: uuid(), fanId, creatorId },
      }).expect(200);

      await ctx.userRepo.update(
        { email: 'creator@test.com' },
        { role: 'admin' },
      );
      const login = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'creator@test.com', password: PASSWORD })
        .expect(200);
      const adminToken = login.body.accessToken;

      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/admin/billing/webhook-events')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0]).toHaveProperty('eventId');
      expect(res.body.data[0]).toHaveProperty('status');
    });

    it('forbids non-admin users', async () => {
      const login = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'fan@test.com', password: PASSWORD })
        .expect(200);

      await request(ctx.app.getHttpServer())
        .get('/api/v1/admin/billing/webhook-events')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(403);
    });
  });
});
