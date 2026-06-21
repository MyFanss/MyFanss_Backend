import { ConfigService } from '@nestjs/config';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

export function getDatabaseConfig(
  configService: ConfigService,
): DatabaseConfig {
  return {
    host: configService.getOrThrow<string>('DB_HOST'),
    port: configService.getOrThrow<number>('DB_PORT'),
    username: configService.getOrThrow<string>('DB_USERNAME'),
    password: configService.getOrThrow<string>('DB_PASSWORD'),
    name: configService.getOrThrow<string>('DB_NAME'),
  };
}

export function getJwtConfig(configService: ConfigService): JwtConfig {
  return {
    accessSecret:
      configService.get<string>('JWT_ACCESS_SECRET') ??
      configService.getOrThrow<string>('JWT_SECRET'),
    refreshSecret:
      configService.get<string>('JWT_REFRESH_SECRET') ??
      'fallback-refresh-secret',
    accessExpiresIn:
      configService.get<string>('JWT_ACCESS_EXPIRATION') ??
      configService.getOrThrow<string>('JWT_EXPIRES_IN'),
    refreshExpiresIn:
      configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d',
  };
}
