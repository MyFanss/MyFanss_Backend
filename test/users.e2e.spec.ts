import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole } from '../src/auth/enums/role.enum';

describe('Users E2E', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear users table before each test
    await userRepository.clear();
  });

  describe('GET /users - Pagination', () => {
    beforeEach(async () => {
      // Create test users
      for (let i = 1; i <= 30; i++) {
        await userRepository.save({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          password: 'hashed',
          role:
            i % 3 === 0
              ? UserRole.ADMIN
              : i % 3 === 1
                ? UserRole.CREATOR
                : UserRole.FAN,
          status: i % 2 === 0 ? 'active' : 'inactive',
          org_id: i % 4 === 0 ? null : (i % 4) + 1,
        });
      }
    });

    it('should return first page without cursor', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ limit: 10 })
        .expect(200);

      expect(res.body.data).toHaveLength(10);
      expect(res.body.pagination.hasMore).toBe(true);
      expect(res.body.pagination.totalCount).toBe(30);
      expect(res.body.pagination.cursor).toBeDefined();
    });

    it('should return next page with cursor', async () => {
      // Get first page
      const res1 = await request(app.getHttpServer())
        .get('/users')
        .query({ limit: 10 })
        .expect(200);

      const cursor = res1.body.pagination.cursor;

      // Get second page
      const res2 = await request(app.getHttpServer())
        .get('/users')
        .query({ cursor, limit: 10 })
        .expect(200);

      expect(res2.body.data).toHaveLength(10);
      expect(res2.body.data[0].id).not.toBe(res1.body.data[0].id);
    });

    it('should handle invalid cursor gracefully', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .query({ cursor: 'invalid-cursor' })
        .expect(400);
    });

    it('should validate limit parameter', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .query({ limit: 101 })
        .expect(400);

      await request(app.getHttpServer())
        .get('/users')
        .query({ limit: 0 })
        .expect(400);
    });
  });

  describe('GET /users - Filtering', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 20; i++) {
        await userRepository.save({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          password: 'hashed',
          role:
            i <= 5 ? UserRole.ADMIN : i <= 15 ? UserRole.CREATOR : UserRole.FAN,
          status: i <= 10 ? 'active' : 'inactive',
          org_id: i % 2 === 0 ? 1 : 2,
        });
      }
    });

    it('should filter by role', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ role: UserRole.ADMIN })
        .expect(200);

      expect(res.body.data.every((u: any) => u.role === UserRole.ADMIN)).toBe(
        true,
      );
      expect(res.body.data.length).toBe(5);
    });

    it('should filter by multiple roles', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ role: 'admin,manager' })
        .expect(200);

      expect(
        res.body.data.every(
          (u: any) => u.role === UserRole.ADMIN || u.role === UserRole.CREATOR,
        ),
      ).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ status: 'active' })
        .expect(200);

      expect(res.body.data.every((u: any) => u.status === 'active')).toBe(true);
    });

    it('should filter by organization', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ org_id: 1 })
        .expect(200);

      expect(res.body.data.every((u: any) => u.org_id === 1)).toBe(true);
    });

    it('should reject invalid role values', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .query({ role: 'invalid_role' })
        .expect(400);
    });

    it('should combine multiple filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ role: UserRole.ADMIN, status: 'active', org_id: 1 })
        .expect(200);

      expect(
        res.body.data.every(
          (u: any) =>
            u.role === UserRole.ADMIN &&
            u.status === 'active' &&
            u.org_id === 1,
        ),
      ).toBe(true);
    });
  });

  describe('GET /users - Sorting', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 10; i++) {
        await userRepository.save({
          name: `User ${String.fromCharCode(96 + i)}`,
          email: `user${i}@example.com`,
          password: 'hashed',
          role: UserRole.FAN,
          status: 'active',
        });
      }
    });

    it('should sort by name ascending', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ sort_by: 'name', sort_order: 'ASC' })
        .expect(200);

      const names = res.body.data.map((u: any) => u.name);
      expect(names).toEqual([...names].sort());
    });

    it('should sort by created_at descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ sort_by: 'created_at', sort_order: 'DESC' })
        .expect(200);

      const dates = res.body.data.map((u: any) =>
        new Date(u.created_at).getTime(),
      );
      expect(dates).toEqual([...dates].sort().reverse());
    });
  });

  describe('GET /users - Search', () => {
    beforeEach(async () => {
      await userRepository.save({
        name: 'John Admin',
        email: 'john.admin@example.com',
        password: 'hashed',
        role: UserRole.ADMIN,
        status: 'active',
      });

      await userRepository.save({
        name: 'Jane Manager',
        email: 'jane.manager@example.com',
        password: 'hashed',
        role: UserRole.CREATOR,
        status: 'active',
      });

      await userRepository.save({
        name: 'Bob User',
        email: 'bob@example.com',
        password: 'hashed',
        role: UserRole.FAN,
        status: 'active',
      });
    });

    it('should search by name', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ search: 'john' })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.some((u: any) => u.name.toLowerCase().includes('john')),
      ).toBe(true);
    });

    it('should search by email', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ search: 'manager' })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should combine search with filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ search: 'admin', role: UserRole.ADMIN })
        .expect(200);

      expect(res.body.data.every((u: any) => u.role === UserRole.ADMIN)).toBe(
        true,
      );
    });
  });

  describe('GET /users - Response Format', () => {
    beforeEach(async () => {
      await userRepository.save({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed',
        role: UserRole.FAN,
        status: 'active',
        org_id: 1,
      });
    });

    it('should return correct response structure', async () => {
      const res = await request(app.getHttpServer()).get('/users').expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('cursor');
      expect(res.body.pagination).toHaveProperty('hasMore');
      expect(res.body.pagination).toHaveProperty('totalCount');
      expect(res.body.pagination).toHaveProperty('limit');
    });

    it('should include user fields in response', async () => {
      const res = await request(app.getHttpServer()).get('/users').expect(200);

      const user = res.body.data[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('status');
      expect(user).toHaveProperty('created_at');
      expect(user).toHaveProperty('updated_at');
    });

    it('should not include password in response', async () => {
      const res = await request(app.getHttpServer()).get('/users').expect(200);

      const user = res.body.data[0];
      expect(user).not.toHaveProperty('password');
    });
  });

  describe('GET /users - Edge Cases', () => {
    it('should return empty result for no matches', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ search: 'nonexistent' })
        .expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.hasMore).toBe(false);
      expect(res.body.pagination.totalCount).toBe(0);
    });

    it('should handle single item result', async () => {
      await userRepository.save({
        name: 'Unique User',
        email: 'unique@example.com',
        password: 'hashed',
        role: UserRole.FAN,
        status: 'active',
      });

      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ search: 'unique', limit: 20 })
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.hasMore).toBe(false);
    });

    it('should handle special characters in search', async () => {
      await userRepository.save({
        name: "O'Brien",
        email: 'obrien@example.com',
        password: 'hashed',
        role: UserRole.FAN,
        status: 'active',
      });

      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ search: 'brien' })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility - Offset Pagination', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 30; i++) {
        await userRepository.save({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          password: 'hashed',
          role: UserRole.FAN,
          status: 'active',
        });
      }
    });

    it('should still support page-based pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ page: 1, page_size: 10 })
        .expect(200);

      expect(res.body.data).toHaveLength(10);
      // Should show deprecation warning
      expect(res.headers['deprecation']).toBe('true');
    });

    it('should navigate pages with offset pagination', async () => {
      const page1 = await request(app.getHttpServer())
        .get('/users')
        .query({ page: 1, page_size: 10 })
        .expect(200);

      const page2 = await request(app.getHttpServer())
        .get('/users')
        .query({ page: 2, page_size: 10 })
        .expect(200);

      expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id);
    });
  });
});
