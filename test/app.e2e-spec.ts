import * as request from 'supertest';
import { createE2eApp, E2eTestApp } from './helpers/e2e-app';

describe('AppController (e2e)', () => {
  let testApp: E2eTestApp;

  beforeAll(async () => {
    testApp = await createE2eApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('/ (GET)', () => {
    return request(testApp.app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
