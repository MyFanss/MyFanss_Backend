/**
 * Integration tests for user profile fields and database-level constraints.
 * Verifies unique email enforcement, profile CRUD persistence, and bio field limits
 * against a real PostgreSQL container.
 */
import * as request from 'supertest';
import {
  IntegrationApp,
  clearAll,
  createIntegrationApp,
  teardownIntegrationApp,
} from './setup';

const PASSWORD = 'Password123!';

describe('User Profile & Constraints (integration)', () => {
  let ctx: IntegrationApp;

  beforeAll(async () => {
    ctx = await createIntegrationApp();
  }, 90_000);

  afterAll(async () => {
    await teardownIntegrationApp(ctx);
  }, 30_000);

  beforeEach(async () => {
    await clearAll(ctx.dataSource);
  });

  function signup(email: string, name = 'Test User') {
    return request(ctx.app.getHttpServer())
      .post('/auth/signup')
      .send({ name, email, password: PASSWORD });
  }

  it('rejects a second signup with the same email (unique constraint)', async () => {
    await signup('dup@test.com').expect(201);
    const res = await signup('dup@test.com').expect(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('allows two users to register with the same display name (not unique)', async () => {
    const r1 = await signup('user-a@test.com', 'Same Name').expect(201);
    const r2 = await signup('user-b@test.com', 'Same Name').expect(201);
    expect(r1.body.user.id).not.toBe(r2.body.user.id);
  });

  it('persists displayName, bio, and avatarUrl via profile update', async () => {
    const signupRes = await signup('profile@test.com').expect(201);
    const { accessToken } = signupRes.body;
    const userId: number = signupRes.body.user.id;

    await request(ctx.app.getHttpServer())
      .patch(`/users/${userId}/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: 'My Handle',
        bio: 'Short bio here',
        avatarUrl: 'https://example.com/avatar.png',
      })
      .expect(200);

    const getRes = await request(ctx.app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(getRes.body.displayName).toBe('My Handle');
    expect(getRes.body.bio).toBe('Short bio here');
    expect(getRes.body.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('enforces bio max length of 300 characters', async () => {
    const signupRes = await signup('biocheck@test.com').expect(201);
    const { accessToken } = signupRes.body;
    const userId: number = signupRes.body.user.id;

    const tooLong = 'x'.repeat(301);

    await request(ctx.app.getHttpServer())
      .patch(`/users/${userId}/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bio: tooLong })
      .expect(400);
  });

  it('email is globally unique across all users', async () => {
    await signup('global@test.com').expect(201);

    // Attempt to create a second account with the same address
    const conflict = await signup('global@test.com');
    expect(conflict.status).toBe(409);
  });
});
