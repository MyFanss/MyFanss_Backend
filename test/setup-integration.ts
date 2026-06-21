process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.TEST_JWT_SECRET ?? 'integration-test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.TEST_JWT_EXPIRES_IN ?? '1h';
process.env.THROTTLE_ENABLED = 'false';
