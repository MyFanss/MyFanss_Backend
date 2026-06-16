import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RateLimitService } from '../services/rate-limit.service';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(private rateLimitService: RateLimitService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract user ID from JWT (assumes JWT guard has already verified token)
    const userId = request.user?.id || request.ip;
    const endpoint = `${request.method}:${request.path}`;

    try {
      // Check both user and global rate limits
      await this.rateLimitService.checkUserRateLimit(String(userId), endpoint);
      await this.rateLimitService.checkGlobalRateLimit(endpoint);

      // Add rate limit headers
      const remaining = await this.rateLimitService.getRemaining(
        String(userId),
        endpoint,
      );
      response.setHeader('X-RateLimit-Limit', '120');
      response.setHeader('X-RateLimit-Remaining', remaining);
      response.setHeader(
        'X-RateLimit-Reset',
        Math.ceil(Date.now() / 1000) + 60,
      );

      return next.handle();
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        const errorResponse = error.getResponse() as any;
        response.setHeader('Retry-After', errorResponse.retryAfter || 60);
        throw error;
      }
      throw error;
    }
  }
}
