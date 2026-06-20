import * as request from 'supertest';
import { clearDatabase, createE2eApp, E2eTestApp } from './helpers/e2e-app';
import { bearerToken, signupUser } from './helpers/auth';

describe('Subscriptions E2E', () => {
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

  async function makeFanAndCreator() {
    const fan = await signupUser(testApp.app, { email: 'fan@example.com' });
    const creator = await signupUser(testApp.app, {
      email: 'creator@example.com',
    });
    return { fan, creator };
  }

  it('rejects unauthenticated subscribe requests', async () => {
    await request(server())
      .post('/subscriptions')
      .send({ creatorId: 1 })
      .expect(401);
  });

  it('lets a fan subscribe to a creator', async () => {
    const { fan, creator } = await makeFanAndCreator();

    const response = await request(server())
      .post('/subscriptions')
      .set('Authorization', bearerToken(fan.token))
      .send({ creatorId: creator.user.id })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      fanId: fan.user.id,
      creatorId: creator.user.id,
      status: 'active',
      cancelledAt: null,
    });
  });

  it('prevents a fan from subscribing to themselves', async () => {
    const { fan } = await makeFanAndCreator();

    await request(server())
      .post('/subscriptions')
      .set('Authorization', bearerToken(fan.token))
      .send({ creatorId: fan.user.id })
      .expect(400);
  });

  it('returns 404 when subscribing to a non-existent creator', async () => {
    const { fan } = await makeFanAndCreator();

    await request(server())
      .post('/subscriptions')
      .set('Authorization', bearerToken(fan.token))
      .send({ creatorId: 999999 })
      .expect(404);
  });

  it('returns 409 on a duplicate active subscription', async () => {
    const { fan, creator } = await makeFanAndCreator();

    await request(server())
      .post('/subscriptions')
      .set('Authorization', bearerToken(fan.token))
      .send({ creatorId: creator.user.id })
      .expect(201);

    await request(server())
      .post('/subscriptions')
      .set('Authorization', bearerToken(fan.token))
      .send({ creatorId: creator.user.id })
      .expect(409);
  });

  it('lets a fan cancel a subscription and hides it from active lists', async () => {
    const { fan, creator } = await makeFanAndCreator();

    await request(server())
      .post('/subscriptions')
      .set('Authorization', bearerToken(fan.token))
      .send({ creatorId: creator.user.id })
      .expect(201);

    const cancelled = await request(server())
      .delete(`/subscriptions/${creator.user.id}`)
      .set('Authorization', bearerToken(fan.token))
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect(cancelled.body.cancelledAt).toEqual(expect.any(String));

    const list = await request(server())
      .get('/subscriptions/me')
      .set('Authorization', bearerToken(fan.token))
      .expect(200);
    expect(list.body.data).toHaveLength(0);
    expect(list.body.pagination.totalCount).toBe(0);
  });

  it('returns 404 when cancelling without an active subscription', async () => {
    const { fan, creator } = await makeFanAndCreator();

    await request(server())
      .delete(`/subscriptions/${creator.user.id}`)
      .set('Authorization', bearerToken(fan.token))
      .expect(404);
  });

  it('reactivates the same subscription row when re-subscribing after a cancel', async () => {
    const { fan, creator } = await makeFanAndCreator();

    const first = await request(server())
      .post('/subscriptions')
      .set('Authorization', bearerToken(fan.token))
      .send({ creatorId: creator.user.id })
      .expect(201);

    await request(server())
      .delete(`/subscriptions/${creator.user.id}`)
      .set('Authorization', bearerToken(fan.token))
      .expect(200);

    const second = await request(server())
      .post('/subscriptions')
      .set('Authorization', bearerToken(fan.token))
      .send({ creatorId: creator.user.id })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.status).toBe('active');
    expect(second.body.cancelledAt).toBeNull();

    const stored = await testApp.dataSource.query(
      'SELECT count(*)::int AS count FROM subscriptions WHERE "fanId" = $1 AND "creatorId" = $2',
      [fan.user.id, creator.user.id],
    );
    expect(stored[0].count).toBe(1);
  });

  it('lists a fan active subscriptions with pagination meta', async () => {
    const { fan, creator } = await makeFanAndCreator();
    const creator2 = await signupUser(testApp.app, {
      email: 'creator2@example.com',
    });

    for (const c of [creator, creator2]) {
      await request(server())
        .post('/subscriptions')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: c.user.id })
        .expect(201);
    }

    const page1 = await request(server())
      .get('/subscriptions/me?page=1&limit=1')
      .set('Authorization', bearerToken(fan.token))
      .expect(200);

    expect(page1.body.data).toHaveLength(1);
    expect(page1.body.pagination).toMatchObject({
      totalCount: 2,
      limit: 1,
      hasMore: true,
    });
  });

  it('lets a creator list subscriber count and subscriber ids', async () => {
    const { fan, creator } = await makeFanAndCreator();
    const fan2 = await signupUser(testApp.app, { email: 'fan2@example.com' });

    for (const f of [fan, fan2]) {
      await request(server())
        .post('/subscriptions')
        .set('Authorization', bearerToken(f.token))
        .send({ creatorId: creator.user.id })
        .expect(201);
    }

    const response = await request(server())
      .get('/creators/me/subscribers')
      .set('Authorization', bearerToken(creator.token))
      .expect(200);

    expect(response.body.pagination.totalCount).toBe(2);
    const fanIds = response.body.data.map((s: { fanId: number }) => s.fanId);
    expect(fanIds).toEqual(expect.arrayContaining([fan.user.id, fan2.user.id]));
  });

  it('only shows a creator their own subscribers (ownership)', async () => {
    const { fan, creator } = await makeFanAndCreator();
    const otherCreator = await signupUser(testApp.app, {
      email: 'other-creator@example.com',
    });

    await request(server())
      .post('/subscriptions')
      .set('Authorization', bearerToken(fan.token))
      .send({ creatorId: creator.user.id })
      .expect(201);

    const response = await request(server())
      .get('/creators/me/subscribers')
      .set('Authorization', bearerToken(otherCreator.token))
      .expect(200);

    expect(response.body.pagination.totalCount).toBe(0);
    expect(response.body.data).toHaveLength(0);
  });
});
