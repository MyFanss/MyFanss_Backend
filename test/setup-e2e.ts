process.env.NODE_ENV = 'test';

process.env.DB_HOST = process.env.TEST_DB_HOST ?? '127.0.0.1';
process.env.DB_PORT = process.env.TEST_DB_PORT ?? '5432';
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'my_fans_test';
process.env.DB_USERNAME = process.env.TEST_DB_USERNAME ?? 'postgres';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? 'postgres';

process.env.JWT_SECRET = process.env.TEST_JWT_SECRET ?? 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.TEST_JWT_EXPIRES_IN ?? '1h';
