import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * Stub per-user token-bucket rate limiter for message sends.
 * Keyed on userId alone (not per-conversation) so a user can't dodge the
 * limit by spreading sends across multiple conversations.
 */
@Injectable()
export class MessageRateLimitGuard implements CanActivate {
  private readonly windowMs = 60 * 1000;
  private readonly maxRequests = 20;

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const key = `ratelimit:message-send:${userId}`;

    const current = ((await this.cacheManager.get(key)) as number) || 0;

    if (current >= this.maxRequests) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many messages sent, please slow down',
          code: 'RATE_LIMITED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.cacheManager.set(key, current + 1, this.windowMs);
    return true;
  }
}
