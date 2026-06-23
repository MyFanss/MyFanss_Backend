import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { GlobalExceptionFilter } from '../../src/exception/globalException.filter';
import type { User } from '../../src/users/user.entity';
import type { RefreshToken } from '../../src/auth/entities/refresh-token.entity';

export interface IntegrationApp {
  app: INestApplication;
  module: TestingModule;
  dataSource: DataSource;
  container?: StartedPostgreSqlContainer;
  userRepo: Repository<User>;
  tokenRepo: Repository<RefreshToken>;
}

function applySharedTestEnv(): void {
  process.env.JWT_SECRET =
    process.env.TEST_JWT_SECRET ?? 'integration-test-jwt-secret';
  process.env.JWT_EXPIRES_IN = process.env.TEST_JWT_EXPIRES_IN ?? '1h';
  process.env.NODE_ENV = 'test';
  process.env.THROTTLE_ENABLED = 'false';
}

function applyExternalDatabaseEnv(): void {
  process.env.DB_HOST = process.env.TEST_DB_HOST ?? '127.0.0.1';
  process.env.DB_PORT = process.env.TEST_DB_PORT ?? '5432';
  process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'my_fans_test';
  process.env.DB_USERNAME = process.env.TEST_DB_USERNAME ?? 'postgres';
  process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? 'postgres';
}

function shouldUseTestcontainers(): boolean {
  // CI uses the GitHub Actions postgres service (see ci.yml).
  // Locally, spin up an isolated Postgres container when Docker is available.
  return process.env.CI !== 'true';
}

async function startDatabase(): Promise<
  StartedPostgreSqlContainer | undefined
> {
  applySharedTestEnv();

  if (!shouldUseTestcontainers()) {
    applyExternalDatabaseEnv();
    return undefined;
  }

  const container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('integration_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getPort());
  process.env.DB_NAME = container.getDatabase();
  process.env.DB_USERNAME = container.getUsername();
  process.env.DB_PASSWORD = container.getPassword();

  return container;
}

/**
 * Boots PostgreSQL (Testcontainers locally, service container in CI),
 * wires env vars for TypeORM, then starts the full NestJS app.
 */
export async function createIntegrationApp(): Promise<IntegrationApp> {
  const container = await startDatabase();

  // Import after DB env is configured — AppModule validates env on load.
  const { AppModule } = await import('../../src/app.module');
  const { User } = await import('../../src/users/user.entity');
  const { RefreshToken } =
    await import('../../src/auth/entities/refresh-token.entity');

  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();

  return {
    app,
    module,
    dataSource: module.get(DataSource),
    container,
    userRepo: module.get<Repository<User>>(getRepositoryToken(User)),
    tokenRepo: module.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
    ),
  };
}

export async function teardownIntegrationApp(
  ctx?: IntegrationApp,
): Promise<void> {
  if (!ctx) {
    return;
  }

  if (ctx.app) {
    await ctx.app.close();
  }

  if (ctx.container) {
    await ctx.container.stop();
  }
}

/** Wipes all tables between tests so specs are order-independent. */
export async function clearAll(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE "refresh_tokens" RESTART IDENTITY CASCADE',
  );
  await dataSource.query('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE');
}
