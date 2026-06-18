import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { clearDatabase, createE2eApp, E2eTestApp } from './helpers/e2e-app';
import {
  bearerToken,
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
    it('creates a user and returns an access and refresh token pair', async () => {
      const payload = buildSignupPayload({
        name: 'Signup User',
        email: 'signup@example.com',
      });

      const response = await request(testApp.app.getHttpServer())
        .post('/auth/signup')
        .set('User-Agent', 'signup-agent')
        .set('X-Device-Id', 'signup-device')
        .send(payload)
        .expect(201);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 900,
        refreshExpiresIn: 604800,
        tokenType: 'Bearer',
        message: 'user created successfully...',
      });
      expect(response.body.user).toMatchObject({
        id: 1,
        name: payload.name,
        email: payload.email,
      });
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('stores refresh tokens hashed and tracks device metadata', async () => {
      const response = await request(testApp.app.getHttpServer())
        .post('/auth/signup')
        .set('User-Agent', 'hashed-agent')
        .set('X-Device-Id', 'hashed-device')
        .send(buildSignupPayload({ email: 'hashed@example.com' }))
        .expect(201);

      const tokens = await testApp.refreshTokenRepository.find();

      expect(tokens).toHaveLength(1);
      expect(tokens[0].tokenHash).not.toBe(response.body.refreshToken);
      const hashMatches = await bcrypt.compare(
        response.body.refreshToken,
        tokens[0].tokenHash,
      );
      expect(hashMatches).toBe(true);
      expect(tokens[0]).toMatchObject({
        deviceId: 'hashed-device',
        userAgent: 'hashed-agent',
        isRevoked: false,
      });
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
    it('logs in an existing user and returns a bearer token pair', async () => {
      const { payload, user: signupUserResponse } = await signupUser(
        testApp.app,
        {
          name: 'Login User',
          email: 'login@example.com',
        },
      );

      const { token, refreshToken, user } = await loginUser(
        testApp.app,
        payload.email,
        TEST_PASSWORD,
      );

      expect(token).toEqual(expect.any(String));
      expect(refreshToken).toEqual(expect.any(String));
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

  describe('refresh token rotation', () => {
    it('rotates a refresh token pair and immediately revokes the old token', async () => {
      const { refreshToken } = await signupUser(testApp.app, {
        email: 'rotate@example.com',
      });

      const response = await request(testApp.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 900,
        refreshExpiresIn: 604800,
        tokenType: 'Bearer',
      });
      expect(response.body.refreshToken).not.toBe(refreshToken);

      const tokens = await testApp.refreshTokenRepository.find({
        order: { createdAt: 'ASC' },
      });
      expect(tokens).toHaveLength(2);
      expect(tokens[0].isRevoked).toBe(true);
      expect(tokens[0].replacedByTokenId).toBe(tokens[1].id);
      expect(tokens[1].isRevoked).toBe(false);
      expect(tokens[1].familyId).toBe(tokens[0].familyId);
    });

    it('detects refresh token reuse and revokes the full token family', async () => {
      const { refreshToken } = await signupUser(testApp.app, {
        email: 'reuse@example.com',
      });

      const rotated = await request(testApp.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const response = await request(testApp.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.code).toBe('REFRESH_TOKEN_REUSE_DETECTED');

      await request(testApp.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401);

      const tokens = await testApp.refreshTokenRepository.find();
      expect(tokens.every((token) => token.isRevoked)).toBe(true);
    });

    it('returns REFRESH_TOKEN_INVALID for malformed refresh tokens', async () => {
      const response = await request(testApp.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'not-a-jwt' })
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        code: 'REFRESH_TOKEN_INVALID',
      });
    });

    it('returns REFRESH_TOKEN_EXPIRED for expired persisted sessions', async () => {
      const { refreshToken } = await signupUser(testApp.app, {
        email: 'expired@example.com',
      });
      const stored = await testApp.refreshTokenRepository.findOneByOrFail({
        isRevoked: false,
      });
      stored.expiresAt = new Date(Date.now() - 1000);
      await testApp.refreshTokenRepository.save(stored);

      const response = await request(testApp.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.code).toBe('REFRESH_TOKEN_EXPIRED');
    });
  });

  describe('session management', () => {
    it('lists active sessions without token hashes or raw tokens', async () => {
      const { token } = await signupUser(testApp.app, {
        email: 'sessions@example.com',
      });

      const response = await request(testApp.app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', bearerToken(token))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: expect.any(String),
        createdAt: expect.any(String),
        expiresAt: expect.any(String),
      });
      expect(response.body[0]).not.toHaveProperty('tokenHash');
      expect(response.body[0]).not.toHaveProperty('refreshToken');
    });

    it('logout revokes only the submitted current session', async () => {
      const { token, refreshToken, payload } = await signupUser(testApp.app, {
        email: 'logout@example.com',
      });
      const secondLogin = await loginUser(testApp.app, payload.email);

      await request(testApp.app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', bearerToken(token))
        .send({ refreshToken })
        .expect(200);

      await request(testApp.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: secondLogin.refreshToken })
        .expect(200);

      const tokens = await testApp.refreshTokenRepository.find({
        order: { createdAt: 'ASC' },
      });
      expect(tokens[0].isRevoked).toBe(true);
      expect(tokens.filter((tokenRow) => tokenRow.isRevoked)).toHaveLength(2);
    });

    it('logout-all revokes every active session for the user', async () => {
      const { token, payload } = await signupUser(testApp.app, {
        email: 'logout-all@example.com',
      });
      await loginUser(testApp.app, payload.email);

      await request(testApp.app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', bearerToken(token))
        .expect(200);

      const tokens = await testApp.refreshTokenRepository.find();
      expect(tokens.every((tokenRow) => tokenRow.isRevoked)).toBe(true);
    });

    it('deletes one session by id', async () => {
      const { token } = await signupUser(testApp.app, {
        email: 'delete-session@example.com',
      });
      const session = await testApp.refreshTokenRepository.findOneByOrFail({
        isRevoked: false,
      });

      await request(testApp.app.getHttpServer())
        .delete(`/auth/sessions/${session.id}`)
        .set('Authorization', bearerToken(token))
        .expect(200);

      const revoked = await testApp.refreshTokenRepository.findOneByOrFail({
        id: session.id,
      });
      expect(revoked.isRevoked).toBe(true);
    });

    it('returns 404 when deleting another user session', async () => {
      const first = await signupUser(testApp.app, {
        email: 'first-session@example.com',
      });
      const second = await signupUser(testApp.app, {
        email: 'second-session@example.com',
      });
      const secondSession = await testApp.refreshTokenRepository.findOneByOrFail(
        {
          userId: second.user.id,
        },
      );

      await request(testApp.app.getHttpServer())
        .delete(`/auth/sessions/${secondSession.id}`)
        .set('Authorization', bearerToken(first.token))
        .expect(404);
    });
  });

  describe('protected route token rules and password changes', () => {
    it('rejects refresh tokens used as bearer access tokens', async () => {
      const { refreshToken } = await signupUser(testApp.app, {
        email: 'refresh-as-access@example.com',
      });

      await request(testApp.app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', bearerToken(refreshToken))
        .expect(401);
    });

    it('password change invalidates all active refresh sessions', async () => {
      const { token, refreshToken, payload, user } = await signupUser(
        testApp.app,
        {
          email: 'password-change@example.com',
        },
      );

      await request(testApp.app.getHttpServer())
        .put(`/users/${user.id}`)
        .set('Authorization', bearerToken(token))
        .send({
          name: payload.name,
          email: payload.email,
          password: 'NewPassword123!',
        })
        .expect(200);

      const tokens = await testApp.refreshTokenRepository.find();
      expect(tokens.every((tokenRow) => tokenRow.isRevoked)).toBe(true);

      const response = await request(testApp.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.code).toBe('REFRESH_TOKEN_REUSE_DETECTED');
    });
  });
});
