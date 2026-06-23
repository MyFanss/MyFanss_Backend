import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler';

export interface ThrottleTierConfig {
  name: string;
  ttl: number; // in seconds
  limit: number;
}

/**
 * Build the list of ThrottlerOption objects from environment variables.
 *
 * Expected env vars (each with a default):
 *   THROTTLE_AUTH_TTL     = 60   (seconds)
 *   THROTTLE_AUTH_LIMIT   = 5
 *   THROTTLE_SHORT_TTL    = 10
 *   THROTTLE_SHORT_LIMIT  = 30
 *   THROTTLE_MEDIUM_TTL   = 60
 *   THROTTLE_MEDIUM_LIMIT = 120
 *   THROTTLE_LONG_TTL     = 3600
 *   THROTTLE_LONG_LIMIT   = 3600
 */
export const TIERS: ThrottleTierConfig[] = [
  {
    name: 'auth',
    ttl: parseInt(process.env.THROTTLE_AUTH_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '5', 10),
  },
  {
    name: 'short',
    ttl: parseInt(process.env.THROTTLE_SHORT_TTL ?? '10', 10),
    limit: parseInt(process.env.THROTTLE_SHORT_LIMIT ?? '30', 10),
  },
  {
    name: 'medium',
    ttl: parseInt(process.env.THROTTLE_MEDIUM_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_MEDIUM_LIMIT ?? '120', 10),
  },
  {
    name: 'long',
    ttl: parseInt(process.env.THROTTLE_LONG_TTL ?? '3600', 10),
    limit: parseInt(process.env.THROTTLE_LONG_LIMIT ?? '3600', 10),
  },
  // Exempt tier → limit=0 means "unlimited" (handled at guard level)
  {
    name: 'exempt',
    ttl: 60,
    limit: 0,
  },
];

export function buildThrottlerModuleOptions(
  configService: ConfigService,
): ThrottlerModuleOptions {
  const enabled =
    configService.get<string>('THROTTLE_ENABLED', 'true') === 'true';
  if (!enabled) {
    return {
      throttlers: [],
    };
  }

  // Compute throttler options: exempt tier gets skipped (handled via guard)
  const throttlers: ThrottlerOptions[] = TIERS.filter(
    (t) => t.name !== 'exempt',
  ).map((tier) => ({
    ttl: tier.ttl,
    limit: tier.limit,
  }));

  return {
    throttlers,
  };
}
