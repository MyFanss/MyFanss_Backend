/**
 * Integration tests for health probes and GDPR self-service endpoints.
 * Uses a real PostgreSQL container to verify behaviour against an actual database.
 */
import * as request from 'supertest';
import {
  IntegrationApp,
  clearAll,
  createIntegrationApp,
  teardownIntegrationApp,
} from './setup';

const PASSWORD = 'Password123!';

describe('Health Probes & GDPR (integration)', () => {
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

  // ---------------------------------------------------------------------------
  // Health endpoints
  // ---------------------------------------------------------------------------

  describe('GET /health/live', () => {
    it('returns 200 with status ok and a timestamp', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(typeof res.body.timestamp).toBe('string');
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 with database status up when DB is reachable', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body.info).toHaveProperty('database');
      expect(res.body.info.database.status).toBe('up');
    });
  });

  // ---------------------------------------------------------------------------
  // GDPR — data export
  // ---------------------------------------------------------------------------

  describe('GET /users/me/export', () => {
    it('returns 401 when not authenticated', async () => {
      await request(ctx.app.getHttpServer())
        .get('/users/me/export')
        .expect(401);
    });

    it('returns exported user data excluding password hash', async () => {
      const signupRes = await request(ctx.app.getHttpServer())
        .post('/auth/signup')
        .send({
          name: 'GDPR User',
          email: `gdpr.${Date.now()}@test.com`,
          password: PASSWORD,
        })
        .expect(201);

      const accessToken: string = signupRes.body.accessToken;

      const res = await request(ctx.app.getHttpServer())
        .get('/users/me/export')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('profile');
      expect(res.body).toHaveProperty('subscriptions');
      expect(res.body).toHaveProperty('exportedAt');
      expect(res.body.profile).not.toHaveProperty('password');
      expect(res.body.profile.name).toBe('GDPR User');
    });
  });

  // ---------------------------------------------------------------------------
  // GDPR — self-delete
  // ---------------------------------------------------------------------------

  describe('DELETE /users/me', () => {
    it('returns 401 when not authenticated', async () => {
      await request(ctx.app.getHttpServer()).delete('/users/me').expect(401);
    });

    it('soft-deletes the user and revokes tokens, returns 204', async () => {
      const signupRes = await request(ctx.app.getHttpServer())
        .post('/auth/signup')
        .send({
          name: 'SelfDelete User',
          email: `selfdel.${Date.now()}@test.com`,
          password: PASSWORD,
        })
        .expect(201);

      const accessToken: string = signupRes.body.accessToken;
      const userId: number = signupRes.body.user.id;

      await request(ctx.app.getHttpServer())
        .delete('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify user is soft-deleted in the database
      const user = await ctx.userRepo.findOneBy({ id: userId });
      expect(user).toBeDefined();
      expect(user!.is_deleted).toBe(true);
      expect(user!.status).toBe('inactive');

      // Verify all refresh tokens are revoked
      const activeTokens = await ctx.tokenRepo.find({
        where: { userId, isRevoked: false },
      });
      expect(activeTokens.length).toBe(0);
    });

    it('deleted user cannot authenticate', async () => {
      const email = `cannotlogin.${Date.now()}@test.com`;
      const signupRes = await request(ctx.app.getHttpServer())
        .post('/auth/signup')
        .send({ name: 'Cannot Login', email, password: PASSWORD })
        .expect(201);

      const accessToken: string = signupRes.body.accessToken;

      await request(ctx.app.getHttpServer())
        .delete('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Attempt to log in with the deleted user
      await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(401);
    });
  });
});
