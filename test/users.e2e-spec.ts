import * as request from 'supertest';
import { bearerToken, signupUser } from './helpers/auth';
import { clearDatabase, createE2eApp, E2eTestApp } from './helpers/e2e-app';

describe('Users E2E', () => {
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

  describe('GET /users/:id', () => {
    it('returns the signed-up user when called with a valid bearer token', async () => {
      const { token, user } = await signupUser(testApp.app, {
        name: 'Protected User',
        email: 'protected@example.com',
      });

      const response = await request(testApp.app.getHttpServer())
        .get(`/users/${user.id}`)
        .set('Authorization', bearerToken(token))
        .expect(200);

      expect(response.body).toMatchObject({
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'user',
        status: 'active',
      });
      expect(response.body).not.toHaveProperty('password');
      expect(response.body.created_at).toEqual(expect.any(String));
      expect(response.body.updated_at).toEqual(expect.any(String));
    });

    it('rejects requests without a bearer token', async () => {
      const { user } = await signupUser(testApp.app, {
        email: 'missing-token@example.com',
      });

      const response = await request(testApp.app.getHttpServer())
        .get(`/users/${user.id}`)
        .expect(401);

      expect(response.body.message).toBe('Unauthorized');
    });

    it('rejects requests with an invalid bearer token', async () => {
      const { user } = await signupUser(testApp.app, {
        email: 'invalid-token@example.com',
      });

      const response = await request(testApp.app.getHttpServer())
        .get(`/users/${user.id}`)
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);

      expect(response.body.message).toBe('Unauthorized');
    });
  });
});
