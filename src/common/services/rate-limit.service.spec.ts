import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RateLimitService } from './rate-limit.service';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let cacheManager: any;

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getStore: jest.fn(() => ({
        getFromMemory: jest.fn(),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkUserRateLimit', () => {
    it('should allow request when under limit', async () => {
      cacheManager.get.mockResolvedValue(50);

      await expect(
        service.checkUserRateLimit('user1', '/users'),
      ).resolves.not.toThrow();
    });

    it('should throw error when limit exceeded', async () => {
      cacheManager.get.mockResolvedValue(120);

      await expect(
        service.checkUserRateLimit('user1', '/users'),
      ).rejects.toThrow(HttpException);
    });

    it('should increment counter on successful request', async () => {
      cacheManager.get.mockResolvedValue(10);

      await service.checkUserRateLimit('user1', '/users');

      expect(cacheManager.set).toHaveBeenCalledWith(
        'ratelimit:user:user1:/users',
        11,
        60000,
      );
    });
  });

  describe('checkGlobalRateLimit', () => {
    it('should allow request when under global limit', async () => {
      cacheManager.get.mockResolvedValue(5000);

      await expect(
        service.checkGlobalRateLimit('/users'),
      ).resolves.not.toThrow();
    });

    it('should throw error when global limit exceeded', async () => {
      cacheManager.get.mockResolvedValue(10000);

      await expect(service.checkGlobalRateLimit('/users')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getRemaining', () => {
    it('should return remaining requests', async () => {
      cacheManager.get.mockResolvedValue(10);

      const remaining = await service.getRemaining('user1', '/users');

      expect(remaining).toBe(110); // 120 - 10
    });

    it('should return 0 when limit exceeded', async () => {
      cacheManager.get.mockResolvedValue(150);

      const remaining = await service.getRemaining('user1', '/users');

      expect(remaining).toBe(0);
    });
  });
});
