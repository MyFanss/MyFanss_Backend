import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

interface RateLimitConfig {
  windowMs: number; // milliseconds
  maxRequests: number;
}

@Injectable()
export class RateLimitService {
  private readonly userLimitConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120,
  };

  private readonly globalLimitConfig: RateLimitConfig = {
    windowMs: 60 * 1000,
    maxRequests: 10000,
  };

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async checkUserRateLimit(userId: string, endpoint: string): Promise<void> {
    const key = `ratelimit:user:${userId}:${endpoint}`;
    const current = ((await this.cacheManager.get(key)) as number) || 0;

    if (current >= this.userLimitConfig.maxRequests) {
      const resetTime = Math.ceil(this.userLimitConfig.windowMs / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later',
          retryAfter: resetTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.cacheManager.set(
      key,
      current + 1,
      this.userLimitConfig.windowMs,
    );
  }

  async checkGlobalRateLimit(endpoint: string): Promise<void> {
    const key = `ratelimit:global:${endpoint}`;
    const current = ((await this.cacheManager.get(key)) as number) || 0;

    if (current >= this.globalLimitConfig.maxRequests) {
      const resetTime = Math.ceil(this.globalLimitConfig.windowMs / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Service rate limit exceeded',
          retryAfter: resetTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.cacheManager.set(
      key,
      current + 1,
      this.globalLimitConfig.windowMs,
    );
  }

  async getRemaining(userId: string, endpoint: string): Promise<number> {
    const key = `ratelimit:user:${userId}:${endpoint}`;
    const current = ((await this.cacheManager.get(key)) as number) || 0;
    return Math.max(0, this.userLimitConfig.maxRequests - current);
  }

  async getReset(userId: string, endpoint: string): Promise<number> {
    // Return default TTL (60 seconds) for the reset time
    // In production with Redis, this would use actual TTL from cache store
    return 60;
  }
}
