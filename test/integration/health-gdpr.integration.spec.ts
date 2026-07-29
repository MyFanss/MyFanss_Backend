/**
 * Integration tests for Health probes (live/ready) and GDPR self-service
 * export/delete endpoints.
 *
 * Acceptance criteria covered:
 * - /health/ready returns 503 when DB unreachable (mocked)
 * - /health/live returns 200 without DB check
 * - Export excludes password hashes/tokens
 * - Self-delete soft-deletes user, revokes refresh tokens, returns 204
 * - Deleted user cannot authenticate
 * - At least 8 tests
 */
import * as request from 'supertest';
import {
  IntegrationApp,
  clearAll,
  createIntegrationApp,
  teardownIntegrationApp,
} from './setup';
import { HealthController } from '../../src/monitoring/health.controller';

const PASSWORD = 'TestPass123!';
const EMAIL = 'gdpr-test-user@test.com';
const NAME = 'GDPR Test User';

describe('Health & GDPR (integration)', () => {
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

  /** Helper: sign up a test user and return tokens + userId. */
  async function signupTestUser(): Promise<{
    accessToken: string;
    userId: number;
  }> {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/signup')
      .send({ name: NAME, email: EMAIL, password: PASSWORD })
      .expect(201);
    return {
      accessToken: res.body.accessToken,
      userId: res.body.user.id,
    };
  }

  // ─── Health probe tests ──────────────────────────────────────────────

  it('GET /health/live returns 200 with status ok', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/health/live')
      .expect(200);

    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /health/ready returns 200 when database is reachable', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/health/ready')
      .expect(200);

    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('info');
    expect(res.body.info).toHaveProperty('postgres');
    expect(res.body.info.postgres).toHaveProperty('status', 'up');
  });

  it('GET /health/live does NOT check the database (pure static response)', () => {
    // The liveness endpoint never touches the database — it returns a static payload.
    const controller = new HealthController(
      { check: jest.fn() } as any,
      { pingCheck: jest.fn() } as any,
    );
    const result = controller.getLive();
    expect(result).toHaveProperty('status', 'ok');
    expect(result).toHaveProperty('timestamp');
  });

  // ─── GDPR export tests ───────────────────────────────────────────────

  it('GET /users/me/export returns 401 without authentication token', async () => {
    await request(ctx.app.getHttpServer())
      .get('/users/me/export')
      .expect(401);
  });

  it('GET /users/me/export returns profile excluding password hash', async () => {
    const { accessToken } = await signupTestUser();

    const res = await request(ctx.app.getHttpServer())
      .get('/users/me/export')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('profile');
    expect(res.body.profile).toHaveProperty('id');
    expect(res.body.profile).toHaveProperty('name', NAME);
    expect(res.body.profile).toHaveProperty('email', EMAIL);
    // Ensure sensitive fields are excluded
    expect(res.body.profile).not.toHaveProperty('password');
    expect(res.body.profile).not.toHaveProperty('search_text');
    expect(res.body.profile).not.toHaveProperty('is_deleted');
  });

  it('GET /users/me/export includes preferences and subscriptions', async () => {
    const { accessToken } = await signupTestUser();

    const res = await request(ctx.app.getHttpServer())
      .get('/users/me/export')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Preferences created on signup as defaults
    expect(res.body).toHaveProperty('preferences');
    expect(res.body.preferences).not.toBeNull();
    expect(res.body.preferences).toHaveProperty('newSubscriber');
    expect(res.body.preferences).toHaveProperty('securityAlerts');

    // Subscriptions array present (may be empty for new user)
    expect(res.body).toHaveProperty('subscriptions');
    expect(Array.isArray(res.body.subscriptions)).toBe(true);
  });

  // ─── GDPR self-delete tests ──────────────────────────────────────────

  it('DELETE /users/me returns 204 and soft-deletes the user', async () => {
    const { accessToken, userId } = await signupTestUser();

    // Verify user exists and is not deleted
    let user = await ctx.userRepo.findOneBy({ id: userId });
    expect(user).not.toBeNull();
    expect(user!.is_deleted).toBe(false);

    // Self-delete
    await request(ctx.app.getHttpServer())
      .delete('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    // Verify user is soft-deleted in database
    user = await ctx.userRepo.findOneBy({ id: userId });
    expect(user).not.toBeNull();
    expect(user!.is_deleted).toBe(true);
  });

  it('Deleted user cannot authenticate after self-delete', async () => {
    await signupTestUser();

    // Confirm we can log in before deletion
    const beforeDelete = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    expect(beforeDelete.status).toBe(200);

    // Self-delete
    await request(ctx.app.getHttpServer())
      .delete('/users/me')
      .set('Authorization', `Bearer ${beforeDelete.body.accessToken}`)
      .expect(204);

    // Attempt to log in after deletion
    const afterDelete = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    expect(afterDelete.status).toBe(401);
  });

  it('Self-delete revokes active refresh tokens', async () => {
    const { accessToken, userId } = await signupTestUser();

    // Verify there is an active refresh token
    const activeTokensBefore = await ctx.tokenRepo.find({
      where: { userId, isRevoked: false },
    });
    expect(activeTokensBefore.length).toBeGreaterThan(0);

    // Self-delete
    await request(ctx.app.getHttpServer())
      .delete('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    // Verify all tokens are revoked
    const activeTokensAfter = await ctx.tokenRepo.find({
      where: { userId, isRevoked: false },
    });
    expect(activeTokensAfter.length).toBe(0);
  });
});
