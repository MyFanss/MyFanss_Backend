import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

export const TEST_PASSWORD = 'Password123!';

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthResult {
  payload: SignupPayload;
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export function buildSignupPayload(
  overrides: Partial<SignupPayload> = {},
): SignupPayload {
  return {
    name: 'Test User',
    email: `user.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`,
    password: TEST_PASSWORD,
    ...overrides,
  };
}

export async function signupUser(
  app: INestApplication,
  overrides: Partial<SignupPayload> = {},
): Promise<AuthResult> {
  const payload = buildSignupPayload(overrides);
  const response = await request(app.getHttpServer())
    .post('/auth/signup')
    .send(payload)
    .expect(201);

  return {
    payload,
    token: response.body.access_token,
    user: response.body.user,
  };
}

export async function loginUser(
  app: INestApplication,
  email: string,
  password = TEST_PASSWORD,
): Promise<AuthResult> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);

  return {
    payload: {
      name: response.body.user.name,
      email,
      password,
    },
    token: response.body.access_token,
    user: response.body.user,
  };
}

export function bearerToken(token: string): string {
  return `Bearer ${token}`;
}
