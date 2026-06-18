import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { User } from '../../src/users/user.entity';

export interface E2eTestApp {
  app: INestApplication;
  moduleFixture: TestingModule;
  dataSource: DataSource;
  userRepository: Repository<User>;
}

export async function createE2eApp(): Promise<E2eTestApp> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return {
    app,
    moduleFixture,
    dataSource: moduleFixture.get(DataSource),
    userRepository: moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    ),
  };
}

export async function clearDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE');
}
