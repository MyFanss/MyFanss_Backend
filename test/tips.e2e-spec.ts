import * as request from 'supertest';
import { clearDatabase, createE2eApp, E2eTestApp } from './helpers/e2e-app';
import { bearerToken, signupUser } from './helpers/auth';

describe('Tips E2E', () => {
  let testApp: E2eTestApp;

  beforeAll(async () => {
    testApp = await createE2eApp();
  });

  beforeEach(async () => {
    await clearDatabase(testApp.dataSource);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  const server = () => testApp.app.getHttpServer();

  async function onboardAsCreator(token: string, handle: string) {
    await request(server())
      .post('/creators/onboard')
      .set('Authorization', bearerToken(token))
      .send({ handle })
      .expect(201);
  }

  async function makeFanAndCreator() {
    const fan = await signupUser(testApp.app, { email: 'fan@example.com' });
    const creator = await signupUser(testApp.app, {
      email: 'creator@example.com',
    });
    await onboardAsCreator(creator.token, 'creator_one');
    return { fan, creator };
  }

  describe('POST /tips/intents', () => {
    it('rejects unauthenticated requests', async () => {
      await request(server())
        .post('/tips/intents')
        .send({ creatorId: 1, amountCents: 500 })
        .expect(401);
    });

    it('rejects tipping yourself', async () => {
      const { fan } = await makeFanAndCreator();

      await request(server())
        .post('/tips/intents')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: fan.user.id, amountCents: 500 })
        .expect(400);
    });

    it('rejects a target that is not a creator', async () => {
      const fan = await signupUser(testApp.app, { email: 'fan1@example.com' });
      const notCreator = await signupUser(testApp.app, {
        email: 'fan2@example.com',
      });

      await request(server())
        .post('/tips/intents')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: notCreator.user.id, amountCents: 500 })
        .expect(404);
    });

    it('rejects amounts below the configured minimum', async () => {
      const { fan, creator } = await makeFanAndCreator();

      await request(server())
        .post('/tips/intents')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: creator.user.id, amountCents: 1 })
        .expect(400);
    });

    it('rejects amounts above the configured maximum', async () => {
      const { fan, creator } = await makeFanAndCreator();

      await request(server())
        .post('/tips/intents')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: creator.user.id, amountCents: 10_000_000 })
        .expect(400);
    });

    it('rejects a message over 500 characters', async () => {
      const { fan, creator } = await makeFanAndCreator();

      await request(server())
        .post('/tips/intents')
        .set('Authorization', bearerToken(fan.token))
        .send({
          creatorId: creator.user.id,
          amountCents: 500,
          message: 'a'.repeat(501),
        })
        .expect(400);
    });

    it('creates a pending tip with server-computed fees', async () => {
      const { fan, creator } = await makeFanAndCreator();

      const response = await request(server())
        .post('/tips/intents')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: creator.user.id, amountCents: 1000, message: 'hi' })
        .expect(201);

      expect(response.body).toMatchObject({
        fanId: fan.user.id,
        creatorId: creator.user.id,
        amountCents: 1000,
        currency: 'USD',
        message: 'hi',
        status: 'pending',
        feeCents: 50, // default 500 bps = 5%
        creatorNetCents: 950,
      });
      expect(response.body.confirmedAt).toBeNull();
    });

    it('is idempotent: replaying the same Idempotency-Key returns the original tip', async () => {
      const { fan, creator } = await makeFanAndCreator();
      const key = 'a3f1f7c0-1111-4a2b-8c3d-000000000001';

      const first = await request(server())
        .post('/tips/intents')
        .set('Authorization', bearerToken(fan.token))
        .set('Idempotency-Key', key)
        .send({ creatorId: creator.user.id, amountCents: 500 })
        .expect(201);

      const second = await request(server())
        .post('/tips/intents')
        .set('Authorization', bearerToken(fan.token))
        .set('Idempotency-Key', key)
        .send({ creatorId: creator.user.id, amountCents: 500 })
        .expect(201);

      expect(second.body.id).toBe(first.body.id);

      const stored = await testApp.dataSource.query(
        'SELECT count(*)::int AS count FROM tips WHERE "idempotencyKey" = $1',
        [key],
      );
      expect(stored[0].count).toBe(1);
    });
  });

  describe('POST /tips/intents/:id/confirm', () => {
    it('completes a pending tip', async () => {
      const { fan, creator } = await makeFanAndCreator();

      const intent = await request(server())
        .post('/tips/intents')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: creator.user.id, amountCents: 500 })
        .expect(201);

      const confirmed = await request(server())
        .post(`/tips/intents/${intent.body.id}/confirm`)
        .set('Authorization', bearerToken(fan.token))
        .send({})
        .expect(201);

      expect(confirmed.body.status).toBe('completed');
      expect(confirmed.body.confirmedAt).toEqual(expect.any(String));
    });

    it('is idempotent on double confirm', async () => {
      const { fan, creator } = await makeFanAndCreator();

      const intent = await request(server())
        .post('/tips/intents')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: creator.user.id, amountCents: 500 })
        .expect(201);

      const first = await request(server())
        .post(`/tips/intents/${intent.body.id}/confirm`)
        .set('Authorization', bearerToken(fan.token))
        .send({})
        .expect(201);

      const second = await request(server())
        .post(`/tips/intents/${intent.body.id}/confirm`)
        .set('Authorization', bearerToken(fan.token))
        .send({})
        .expect(201);

      expect(second.body).toMatchObject({
        id: first.body.id,
        status: 'completed',
        confirmedAt: first.body.confirmedAt,
      });
    });

    it('returns 409 when confirming an already-failed tip', async () => {
      const { fan, creator } = await makeFanAndCreator();

      const intent = await request(server())
        .post('/tips/intents')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: creator.user.id, amountCents: 500 })
        .expect(201);

      await request(server())
        .post(`/tips/intents/${intent.body.id}/confirm`)
        .set('Authorization', bearerToken(fan.token))
        .send({ simulateFailure: true })
        .expect(201);

      await request(server())
        .post(`/tips/intents/${intent.body.id}/confirm`)
        .set('Authorization', bearerToken(fan.token))
        .send({})
        .expect(409);
    });

    it('returns 404 when a different fan tries to confirm the tip', async () => {
      const { fan, creator } = await makeFanAndCreator();
      const otherFan = await signupUser(testApp.app, {
        email: 'other-fan@example.com',
      });

      const intent = await request(server())
        .post('/tips/intents')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: creator.user.id, amountCents: 500 })
        .expect(201);

      await request(server())
        .post(`/tips/intents/${intent.body.id}/confirm`)
        .set('Authorization', bearerToken(otherFan.token))
        .send({})
        .expect(404);
    });

    it('returns 404 for a non-existent tip id', async () => {
      const { fan } = await makeFanAndCreator();

      await request(server())
        .post('/tips/intents/00000000-0000-0000-0000-000000000000/confirm')
        .set('Authorization', bearerToken(fan.token))
        .send({})
        .expect(404);
    });
  });

  describe('POST /tips (shorthand)', () => {
    it('creates and confirms a tip in one call', async () => {
      const { fan, creator } = await makeFanAndCreator();

      const response = await request(server())
        .post('/tips')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: creator.user.id, amountCents: 500 })
        .expect(201);

      expect(response.body.status).toBe('completed');
      expect(response.body.confirmedAt).toEqual(expect.any(String));
    });
  });

  describe('GET /tips/me and GET /creators/me/tips', () => {
    it('only shows a fan their own tips', async () => {
      const { fan, creator } = await makeFanAndCreator();
      const otherFan = await signupUser(testApp.app, {
        email: 'other-fan2@example.com',
      });

      await request(server())
        .post('/tips')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: creator.user.id, amountCents: 500 })
        .expect(201);

      const mine = await request(server())
        .get('/tips/me')
        .set('Authorization', bearerToken(fan.token))
        .expect(200);
      expect(mine.body.pagination.totalCount).toBe(1);

      const others = await request(server())
        .get('/tips/me')
        .set('Authorization', bearerToken(otherFan.token))
        .expect(200);
      expect(others.body.pagination.totalCount).toBe(0);
    });

    it('only shows a creator their own tip inbox', async () => {
      const { fan, creator } = await makeFanAndCreator();
      const otherCreator = await signupUser(testApp.app, {
        email: 'other-creator@example.com',
      });
      await onboardAsCreator(otherCreator.token, 'other_creator');

      await request(server())
        .post('/tips')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: creator.user.id, amountCents: 500 })
        .expect(201);

      const inbox = await request(server())
        .get('/creators/me/tips')
        .set('Authorization', bearerToken(creator.token))
        .expect(200);
      expect(inbox.body.pagination.totalCount).toBe(1);
      expect(inbox.body.data[0].creatorId).toBe(creator.user.id);

      const otherInbox = await request(server())
        .get('/creators/me/tips')
        .set('Authorization', bearerToken(otherCreator.token))
        .expect(200);
      expect(otherInbox.body.pagination.totalCount).toBe(0);
    });

    it('rejects unauthenticated inbox/history requests', async () => {
      await request(server()).get('/tips/me').expect(401);
      await request(server()).get('/creators/me/tips').expect(401);
    });
  });
});
