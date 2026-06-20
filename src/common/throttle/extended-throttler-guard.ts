import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerRequest,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  ThrottlerLimitDetail,
} from '@nestjs/throttler';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { AppLogger } from '../../logger/app-logger.service';
import { TIERS } from './throttle.config';

export const RATE_LIMIT_TIER_KEY = 'rate_limit_tier';

export function getTierName(context: ExecutionContext, reflector: Reflector): string | undefined {
  return reflector.getAllAndOverride<string>(RATE_LIMIT_TIER_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
}

/**
 * Extended ThrottlerGuard that:
 * - Uses IP keying for unauthenticated requests, userId|IP for authenticated
 * - Honors X-Forwarded-For only when TRUST_PROXY=true
 * - Supports named tiers: auth, short, medium, long, exempt
 * - Logs warnings and increments Prometheus counter on violation
 */
@Injectable()
export class ExtendedThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new AppLogger();

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    @InjectMetric('http_rate_limit_exceeded_total')
    private readonly rateLimitExceededCounter?: Counter<string>,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Skip throttling for exempt-tier endpoints.
   */
  async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const tierName = getTierName(context, this.reflector);
    if (tierName === 'exempt') {
      return true;
    }
    return super.shouldSkip(context);
  }

  /**
   * Determine the tracker key per request.
   * Authenticated requests use "userId:ip", unauthenticated use "ip".
   * Honors X-Forwarded-For only when TRUST_PROXY=true.
   */
  async getTracker(req: Record<string, any>): Promise<string> {
    const trustProxy = process.env.TRUST_PROXY === 'true';
    let ip: string;

    if (trustProxy && req.headers?.['x-forwarded-for']) {
      const forwarded = req.headers['x-forwarded-for'] as string;
      ip = forwarded.split(',')[0].trim();
    } else {
      ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    }

    if (req.user?.userId || req.user?.id) {
      const userId = req.user.userId ?? req.user.id;
      return `${userId}:${ip}`;
    }

    return ip;
  }

  /**
   * Override handleRequest to:
   * - Log a warning when limit is exceeded
   * - Increment the Prometheus counter
   * - Set Retry-After header on violation
   */
  async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration, getTracker, generateKey } = requestProps;
    const { req, res } = this.getRequestResponse(context);

    const tracker = await getTracker(req, context);
    const key = generateKey(context, tracker, throttler.name ?? 'default');

    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
      await this.storageService.increment(key, ttl, limit, blockDuration, throttler.name ?? 'default');

    if (isBlocked) {
      res.header('Retry-After', timeToBlockExpire);

      this.logger.warn(
        `Rate limit exceeded: tracker=${tracker} limit=${limit} ttl=${ttl} retryAfter=${timeToBlockExpire}`,
        ExtendedThrottlerGuard.name,
      );

      const tierName = throttler.name ?? 'default';
      this.rateLimitExceededCounter?.inc({ tier: tierName });

      await this.throwThrottlingException(context, {
        limit,
        ttl,
        key,
        tracker,
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      });
    }

    return true;
  }

  /**
   * Override error message to match CorrelationExceptionFilter format.
   */
  async getErrorMessage(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<string> {
    return 'Too many requests, please try again later';
  }
}

