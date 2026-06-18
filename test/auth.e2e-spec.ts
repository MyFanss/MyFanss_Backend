import * as request from 'supertest';
import { clearDatabase, createE2eApp, E2eTestApp } from './helpers/e2e-app';
import {
  buildSignupPayload,
  loginUser,
  signupUser,
  TEST_PASSWORD,
} from './helpers/auth';

describe('Auth E2E', () => {
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

  describe('POST /auth/signup', () => {
    it('creates a user and returns a token without exposing the password', async () => {
      const payload = buildSignupPayload({
        name: 'Signup User',
        email: 'signup@example.com',
      });

      const response = await request(testApp.app.getHttpServer())
        .post('/auth/signup')
        .send(payload)
        .expect(201);

      expect(response.body.access_token).toEqual(expect.any(String));
      expect(response.body.expires_in).toBe('1h');
      expect(response.body.message).toBe('user created successfully...');
      expect(response.body.user).toMatchObject({
        id: 1,
        name: payload.name,
        email: payload.email,
      });
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('rejects duplicate email signup', async () => {
      const payload = buildSignupPayload({
        email: 'duplicate@example.com',
      });

      await request(testApp.app.getHttpServer())
        .post('/auth/signup')
        .send(payload)
        .expect(201);

      const response = await request(testApp.app.getHttpServer())
        .post('/auth/signup')
        .send(payload)
        .expect(409);

      expect(response.body.message).toBe('user already exists with this email');
    });
  });

  describe('POST /auth/login', () => {
    it('logs in an existing user and returns a bearer token payload', async () => {
      const { payload, user: signupUserResponse } = await signupUser(
        testApp.app,
        {
          name: 'Login User',
          email: 'login@example.com',
        },
      );

      const { token, user } = await loginUser(
        testApp.app,
        payload.email,
        TEST_PASSWORD,
      );

      expect(token).toEqual(expect.any(String));
      expect(user).toEqual(signupUserResponse);
      expect(user.email).toBe(payload.email);
    });

    it('rejects invalid login credentials', async () => {
      const { payload } = await signupUser(testApp.app, {
        email: 'invalid-login@example.com',
      });

      const response = await request(testApp.app.getHttpServer())
        .post('/auth/login')
        .send({ email: payload.email, password: 'WrongPassword123!' })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });
  });
});
