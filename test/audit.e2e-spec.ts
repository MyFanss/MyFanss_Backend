import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';
import { AuditLog } from '../src/audit/audit.entity';
import { AuditAction } from '../src/audit/audit-action.enum';
import { GlobalExceptionFilter } from '../src/exception/globalException.filter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { clearDatabase } from './helpers/e2e-app';
import { signupUser, loginUser, bearerToken } from './helpers/auth';

describe('Audit Logs (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auditLogRepository: Repository<AuditLog>;
  let userRepository: Repository<User>;

  let adminToken: string;
  let adminUser: { id: number; email: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    auditLogRepository = moduleFixture.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );
    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
  });

  beforeEach(async () => {
    await clearDatabase(dataSource);

    // Create an admin user by directly setting the role in DB
    const adminSignup = await signupUser(app, { name: 'Admin User' });
    await userRepository.update(adminSignup.user.id, { role: 'admin' });
    adminUser = adminSignup.user;

    // Re-login to get a fresh token (role not in JWT, but guard queries DB)
    const adminLogin = await loginUser(app, adminSignup.payload.email);
    adminToken = adminLogin.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/audit-logs', () => {
    it('should return 403 for non-admin users', async () => {
      const nonAdmin = await signupUser(app);

      await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .set('Authorization', bearerToken(nonAdmin.token))
        .expect(403);
    });

    it('should return 200 with paginated results for admin', async () => {
      // Seed some audit logs
      await auditLogRepository.save([
        {
          actorId: adminUser.id,
          action: AuditAction.USER_DELETED,
          targetType: 'User',
          targetId: 99,
          metadata: {},
          createdAt: new Date(),
        },
        {
          actorId: adminUser.id,
          action: AuditAction.USER_ROLE_CHANGED,
          targetType: 'User',
          targetId: 100,
          metadata: { before: 'user', after: 'admin' },
          createdAt: new Date(),
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .set('Authorization', bearerToken(adminToken))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toMatchObject({
        hasMore: false,
        totalCount: 2,
      });
    });

    it('should filter by action', async () => {
      await auditLogRepository.save([
        {
          actorId: adminUser.id,
          action: AuditAction.USER_DELETED,
          targetType: 'User',
          targetId: 1,
          createdAt: new Date(),
        },
        {
          actorId: adminUser.id,
          action: AuditAction.USER_ROLE_CHANGED,
          targetType: 'User',
          targetId: 2,
          createdAt: new Date(),
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .query({ action: AuditAction.USER_ROLE_CHANGED })
        .set('Authorization', bearerToken(adminToken))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].action).toBe(AuditAction.USER_ROLE_CHANGED);
    });

    it('should filter by date range', async () => {
      await auditLogRepository.save([
        {
          actorId: adminUser.id,
          action: AuditAction.USER_DELETED,
          targetType: 'User',
          targetId: 1,
          createdAt: new Date('2024-01-15'),
        },
        {
          actorId: adminUser.id,
          action: AuditAction.USER_LOGIN_FAILED,
          targetType: 'User',
          targetId: null,
          createdAt: new Date('2024-06-15'),
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .query({
          startDate: '2024-06-01',
          endDate: '2024-12-31',
        })
        .set('Authorization', bearerToken(adminToken))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].action).toBe(AuditAction.USER_LOGIN_FAILED);
    });

    it('should only allow GET — no PATCH, PUT, or DELETE', async () => {
      await request(app.getHttpServer())
        .patch('/admin/audit-logs')
        .set('Authorization', bearerToken(adminToken))
        .expect(404);

      await request(app.getHttpServer())
        .put('/admin/audit-logs')
        .set('Authorization', bearerToken(adminToken))
        .expect(404);

      await request(app.getHttpServer())
        .delete('/admin/audit-logs')
        .set('Authorization', bearerToken(adminToken))
        .expect(404);
    });
  });
});
