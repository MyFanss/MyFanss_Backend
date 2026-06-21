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
});

function assertJwtConfig(value: Record<string, unknown>): void {
  const errors: string[] = [];

  if (!value.JWT_SECRET && !value.JWT_ACCESS_SECRET) {
    errors.push('JWT_SECRET or JWT_ACCESS_SECRET is required');
  }

  if (!value.JWT_EXPIRES_IN && !value.JWT_ACCESS_EXPIRATION) {
    errors.push('JWT_EXPIRES_IN or JWT_ACCESS_EXPIRATION is required');
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
