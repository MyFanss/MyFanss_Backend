import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validConfig = {
    NODE_ENV: 'development',
    PORT: '3000',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_NAME: 'my_fans_db',
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 'postgres',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '1h',
  };

  it('accepts a valid configuration', () => {
    expect(() => validateEnv(validConfig)).not.toThrow();
  });

  it('accepts JWT_ACCESS_SECRET and JWT_ACCESS_EXPIRATION aliases', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        PORT: '3000',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'my_fans_db',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'postgres',
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_ACCESS_EXPIRATION: '15m',
      }),
    ).not.toThrow();
  });

  it('rejects missing JWT secret', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        PORT: '3000',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'my_fans_db',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'postgres',
        JWT_EXPIRES_IN: '1h',
      }),
    ).toThrow(/JWT_SECRET or JWT_ACCESS_SECRET is required/);
  });

  it('rejects missing JWT expiration', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        PORT: '3000',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'my_fans_db',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'postgres',
        JWT_SECRET: 'test-secret',
      }),
    ).toThrow(/JWT_EXPIRES_IN or JWT_ACCESS_EXPIRATION is required/);
  });

  it('rejects missing database credentials', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        PORT: '3000',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'my_fans_db',
        DB_USERNAME: 'postgres',
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '1h',
      }),
    ).toThrow(/DB_PASSWORD/);
  });

  it('rejects invalid PORT values', () => {
    expect(() => validateEnv({ ...validConfig, PORT: 'not-a-port' })).toThrow(
      /PORT/,
    );
  });

  it('rejects invalid DB_PORT values', () => {
    expect(() =>
      validateEnv({ ...validConfig, DB_PORT: 'not-a-port' }),
    ).toThrow(/DB_PORT/);
  });
});
