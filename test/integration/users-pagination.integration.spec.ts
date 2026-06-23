import * as request from 'supertest';
import {
  IntegrationApp,
  clearAll,
  createIntegrationApp,
  teardownIntegrationApp,
} from './setup';

describe('Users Pagination (integration)', () => {
  let ctx: IntegrationApp;
  let adminToken: string;

  const PASSWORD = 'Password123!';

  beforeAll(async () => {
    ctx = await createIntegrationApp();
  }, 90_000);

  afterAll(async () => {
    await teardownIntegrationApp(ctx);
  }, 30_000);

  beforeEach(async () => {
    await clearAll(ctx.dataSource);
    // Create an admin user and get a token to call GET /users
    const signup = await request(ctx.app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Admin', email: 'admin@test.com', password: PASSWORD })
      .expect(201);
    adminToken = signup.body.accessToken;

    // Promote to admin directly in DB so the user can list all users
    await ctx.userRepo.update({ email: 'admin@test.com' }, { role: 'admin' });
  });

  async function seedUsers(count: number) {
    for (let i = 1; i <= count; i++) {
      await request(ctx.app.getHttpServer())
        .post('/auth/signup')
        .send({
          name: `User ${i}`,
          email: `user${i}@test.com`,
          password: PASSWORD,
        });
    }
  }

  it('returns the first page of users with default limit', async () => {
    await seedUsers(5);

    const res = await request(ctx.app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.pagination).toBeDefined();
    // 5 seeded + 1 admin = 6 total, all on first page (default limit 20)
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);
  });

  it('respects the limit query parameter', async () => {
    await seedUsers(10);

    const res = await request(ctx.app.getHttpServer())
      .get('/users?limit=3')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(3);
    expect(res.body.pagination.hasMore).toBe(true);
    expect(res.body.pagination.limit).toBe(3);
  });

  it('provides a cursor for the next page and the next page is different', async () => {
    await seedUsers(6);

    const page1 = await request(ctx.app.getHttpServer())
      .get('/users?limit=3')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const cursor = page1.body.pagination.cursor;
    expect(cursor).toBeTruthy();

    const page2 = await request(ctx.app.getHttpServer())
      .get(`/users?limit=3&cursor=${cursor}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const page1Ids = page1.body.data.map((u: { id: number }) => u.id);
    const page2Ids = page2.body.data.map((u: { id: number }) => u.id);
    // Pages must not overlap
    const overlap = page1Ids.filter((id: number) => page2Ids.includes(id));
    expect(overlap.length).toBe(0);
  });

  it('filters users by role', async () => {
    await seedUsers(3);
    // Promote one to manager
    await ctx.userRepo.update({ email: 'user1@test.com' }, { role: 'manager' });

    const res = await request(ctx.app.getHttpServer())
      .get('/users?role=manager')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].role).toBe('manager');
  });

  it('filters users by status', async () => {
    await seedUsers(3);
    await ctx.userRepo.update(
      { email: 'user2@test.com' },
      { status: 'suspended' },
    );

    const res = await request(ctx.app.getHttpServer())
      .get('/users?status=suspended')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].status).toBe('suspended');
  });

  it('returns hasMore false when all results fit in one page', async () => {
    await seedUsers(2);

    const res = await request(ctx.app.getHttpServer())
      .get('/users?limit=20')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.pagination.hasMore).toBe(false);
  });

  it('searches users by name', async () => {
    await request(ctx.app.getHttpServer()).post('/auth/signup').send({
      name: 'Unique Name',
      email: 'unique@test.com',
      password: PASSWORD,
    });
    await request(ctx.app.getHttpServer()).post('/auth/signup').send({
      name: 'Other Person',
      email: 'other@test.com',
      password: PASSWORD,
    });

    const res = await request(ctx.app.getHttpServer())
      .get('/users?search=Unique')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      res.body.data.some((u: { name: string }) => u.name === 'Unique Name'),
    ).toBe(true);
    expect(
      res.body.data.every((u: { name: string }) => u.name !== 'Other Person'),
    ).toBe(true);
  });
});
