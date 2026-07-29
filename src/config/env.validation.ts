import * as Joi from 'joi';

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().required(),
  DB_NAME: Joi.string().required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  JWT_SECRET: Joi.string().min(1).optional(),
  JWT_ACCESS_SECRET: Joi.string().min(1).optional(),
  JWT_EXPIRES_IN: Joi.string().min(1).optional(),
  JWT_ACCESS_EXPIRATION: Joi.string().min(1).optional(),
  JWT_REFRESH_SECRET: Joi.string().min(1).optional(),
  JWT_REFRESH_EXPIRATION: Joi.string().min(1).optional(),
  TIP_PLATFORM_FEE_BPS: Joi.number().integer().min(0).max(10000).default(500),
  TIP_MIN_AMOUNT_CENTS: Joi.number().integer().min(1).default(100),
  TIP_MAX_AMOUNT_CENTS: Joi.number().integer().min(1).default(100000),
  MAILER_DRIVER: Joi.string().valid('console', 'smtp').default('console'),
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().port().optional(),
  SMTP_SECURE: Joi.string().valid('true', 'false').optional(),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  SMTP_FROM: Joi.string().optional(),
  MAILER_TIMEOUT_MS: Joi.number().integer().min(1).default(10000),
});

function assertJwtConfig(value: Record<string, unknown>): void {
  const errors: string[] = [];

  if (!value.JWT_SECRET && !value.JWT_ACCESS_SECRET) {
    errors.push('JWT_SECRET or JWT_ACCESS_SECRET is required');
  }

  if (!value.JWT_EXPIRES_IN && !value.JWT_ACCESS_EXPIRATION) {
    errors.push('JWT_EXPIRES_IN or JWT_ACCESS_EXPIRATION is required');
  }

  // In production, an unverified billing webhook would let anyone flip
  // subscription state — refuse to boot rather than silently accepting
  // unsigned events.
  if (value.NODE_ENV === 'production' && !value.BILLING_WEBHOOK_SECRET) {
    errors.push('BILLING_WEBHOOK_SECRET is required when NODE_ENV=production');
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map((message) => `  - ${message}`).join('\n')}`,
    );
  }
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = envSchema.validate(config, {
    allowUnknown: true,
    abortEarly: false,
    convert: true,
  });

  if (result.error) {
    const details = result.error.details.map(
      (detail) => `  - ${detail.message}`,
    );
    throw new Error(`Environment validation failed:\n${details.join('\n')}`);
  }

  const value = result.value as Record<string, unknown>;
  assertJwtConfig(value);

  return value;
}
