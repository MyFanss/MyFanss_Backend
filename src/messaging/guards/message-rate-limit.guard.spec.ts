import { HttpException, HttpStatus } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { MessageRateLimitGuard } from './message-rate-limit.guard';

describe('MessageRateLimitGuard', () => {
  let guard: MessageRateLimitGuard;
  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const buildContext = (userId: number): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId },
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new MessageRateLimitGuard(mockCacheManager as any);
    jest.clearAllMocks();
  });

  it('allows the request and increments the counter when under the limit', async () => {
    mockCacheManager.get.mockResolvedValue(5);

    const result = await guard.canActivate(buildContext(1));

    expect(result).toBe(true);
    expect(mockCacheManager.set).toHaveBeenCalledWith(
      'ratelimit:message-send:1',
      6,
      60 * 1000,
    );
  });

  it('throws 429 when the per-user limit is exceeded (rate limit trip)', async () => {
    mockCacheManager.get.mockResolvedValue(20);

    await expect(guard.canActivate(buildContext(1))).rejects.toThrow(
      HttpException,
    );
    await expect(guard.canActivate(buildContext(1))).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(mockCacheManager.set).not.toHaveBeenCalled();
  });

  it('keys the counter independently per user', async () => {
    mockCacheManager.get.mockResolvedValue(0);

    await guard.canActivate(buildContext(1));
    expect(mockCacheManager.set).toHaveBeenCalledWith(
      'ratelimit:message-send:1',
      1,
      60 * 1000,
    );

    await guard.canActivate(buildContext(2));
    expect(mockCacheManager.set).toHaveBeenCalledWith(
      'ratelimit:message-send:2',
      1,
      60 * 1000,
    );
  });
});
