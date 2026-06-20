import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { AppModule } from '../../src/app.module';
import { User } from '../../src/users/user.entity';
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity';
import { GlobalExceptionFilter } from '../../src/exception/globalException.filter';

export interface IntegrationApp {
  app: INestApplication;
  module: TestingModule;
  dataSource: DataSource;
  container: StartedPostgreSqlContainer;
  userRepo: Repository<User>;
  tokenRepo: Repository<RefreshToken>;
}

/**
 * Boots a PostgreSQL container via Testcontainers, wires environment variables
 * so NestJS's TypeORM module connects to it, then starts the full NestJS app.
 * TypeORM's synchronize:true creates the schema; no credentials from .env are used.
 */
export async function createIntegrationApp(): Promise<IntegrationApp> {
  const container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('integration_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  // Point the app's TypeORM config at the fresh container
  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getPort());
  process.env.DB_NAME = container.getDatabase();
  process.env.DB_USERNAME = container.getUsername();
  process.env.DB_PASSWORD = container.getPassword();
  process.env.JWT_SECRET = 'integration-test-jwt-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.NODE_ENV = 'test';

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
  ctx: IntegrationApp,
): Promise<void> {
  await ctx.app.close();
  await ctx.container.stop();
}

/** Wipes all tables between tests so specs are order-independent. */
export async function clearAll(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE "refresh_tokens" RESTART IDENTITY CASCADE',
  );
  await dataSource.query('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE');
}
