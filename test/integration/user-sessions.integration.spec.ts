/**
 * Integration tests for the session lifecycle:
 * sign up → login → refresh token rotation → logout → logout-all.
 * Each test uses a real PostgreSQL container so refresh token persistence
 * and revocation logic is exercised against an actual database.
 */
import * as request from 'supertest';
import {
  IntegrationApp,
  clearAll,
  createIntegrationApp,
  teardownIntegrationApp,
} from './setup';

const PASSWORD = 'Password123!';
const EMAIL = 'session-user@test.com';
const NAME = 'Session User';

describe('User Sessions (integration)', () => {
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

  async function signup(): Promise<{ accessToken: string; refreshToken: string; userId: number }> {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/signup')
      .send({ name: NAME, email: EMAIL, password: PASSWORD })
      .expect(201);
    return {
      accessToken: res.body.accessToken,
      refreshToken: res.body.refreshToken,
      userId: res.body.user.id,
    };
  }

  async function login(): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    return { accessToken: res.body.accessToken, refreshToken: res.body.refreshToken };
  }

  it('signup persists a refresh token row in the database', async () => {
    const { userId } = await signup();
    const tokens = await ctx.tokenRepo.find({ where: { userId, isRevoked: false } });
    expect(tokens.length).toBe(1);
  });

  it('login creates an additional session without invalidating the signup session', async () => {
    const { userId } = await signup();
    await login();
    const activeSessions = await ctx.tokenRepo.find({ where: { userId, isRevoked: false } });
    expect(activeSessions.length).toBe(2);
  });

  it('refresh token rotation issues a new token and revokes the old one', async () => {
    const { refreshToken: original, accessToken } = await signup();

    const res = await request(ctx.app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken: original })
      .expect(200);

    const newRefreshToken: string = res.body.refreshToken;
    expect(newRefreshToken).toBeDefined();
    expect(newRefreshToken).not.toBe(original);

    // Old token must now be revoked in the DB
    const allTokens = await ctx.tokenRepo.find();
    const revokedOld = allTokens.find((t) => t.isRevoked);
    expect(revokedOld).toBeTruthy();
  });

  it('logout revokes the specific refresh token', async () => {
    const { refreshToken, accessToken, userId } = await signup();

    await request(ctx.app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);

    const activeTokens = await ctx.tokenRepo.find({ where: { userId, isRevoked: false } });
    expect(activeTokens.length).toBe(0);
  });

  it('logout-all revokes every active session for the user', async () => {
    const { accessToken, userId } = await signup();
    // Open two more sessions
    await login();
    await login();

    await request(ctx.app.getHttpServer())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const activeTokens = await ctx.tokenRepo.find({ where: { userId, isRevoked: false } });
    expect(activeTokens.length).toBe(0);
  });

  it('reusing a revoked refresh token is rejected with 401', async () => {
    const { refreshToken } = await signup();

    // First rotation — invalidates original
    await request(ctx.app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    // Attempt to reuse the now-revoked token
    await request(ctx.app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
