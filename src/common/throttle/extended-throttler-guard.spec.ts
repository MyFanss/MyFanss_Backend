import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerModuleOptions,
  ThrottlerStorage,
  getOptionsToken,
  getStorageToken,
} from '@nestjs/throttler';
import { ExtendedThrottlerGuard } from './extended-throttler-guard';

describe('ExtendedThrottlerGuard', () => {
  let guard: ExtendedThrottlerGuard;
  let mockStorage: jest.Mocked<ThrottlerStorage>;
  let mockReflector: jest.Mocked<Reflector>;
  let mockCounter: { inc: jest.Mock };

  const throttlerOptions: ThrottlerModuleOptions = {
    throttlers: [
      { name: 'auth', ttl: 60000, limit: 5 },
      { name: 'short', ttl: 10000, limit: 30 },
      { name: 'medium', ttl: 60000, limit: 120 },
      { name: 'long', ttl: 3600000, limit: 3600 },
    ],
  };

  beforeEach(async () => {
    mockStorage = {
      increment: jest.fn(),
    } as any;

    mockReflector = {
      getAllAndOverride: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      getAllAndMerge: jest.fn(),
    } as any;

    mockCounter = { inc: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExtendedThrottlerGuard,
        {
          provide: getOptionsToken(),
          useValue: throttlerOptions,
        },
        {
          provide: getStorageToken(),
          useValue: mockStorage,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: 'PROM_METRIC_HTTP_RATE_LIMIT_EXCEEDED_TOTAL',
          useValue: mockCounter,
        },
      ],
    }).compile();

    guard = module.get<ExtendedThrottlerGuard>(ExtendedThrottlerGuard);
    // Trigger onModuleInit to initialize throttlers
    await guard.onModuleInit();
  });

  describe('getTracker', () => {
    const mockContext = {} as any;

    it('should return IP for unauthenticated requests', async () => {
      const req = { ip: '192.168.1.1', headers: {} };
      const tracker = await (guard as any).getTracker(req, mockContext);
      expect(tracker).toBe('192.168.1.1');
    });

    it('should return userId:ip for authenticated requests', async () => {
      const req = {
        ip: '192.168.1.1',
        headers: {},
        user: { userId: 42, email: 'test@test.com' },
      };
      const tracker = await (guard as any).getTracker(req, mockContext);
      expect(tracker).toBe('42:192.168.1.1');
    });

    it('should use user.id fallback when userId is absent', async () => {
      const req = {
        ip: '10.0.0.1',
        headers: {},
        user: { id: 99 },
      };
      const tracker = await (guard as any).getTracker(req, mockContext);
      expect(tracker).toBe('99:10.0.0.1');
    });

    it('should honor X-Forwarded-For when TRUST_PROXY=true', async () => {
      process.env.TRUST_PROXY = 'true';
      const req = {
        ip: '10.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
      };
      const tracker = await (guard as any).getTracker(req, mockContext);
      expect(tracker).toBe('203.0.113.5');
      delete process.env.TRUST_PROXY;
    });

    it('should NOT honor X-Forwarded-For when TRUST_PROXY is false', async () => {
      process.env.TRUST_PROXY = 'false';
      const req = {
        ip: '10.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
      };
      const tracker = await (guard as any).getTracker(req, mockContext);
      expect(tracker).toBe('10.0.0.1');
      delete process.env.TRUST_PROXY;
    });

    it('should fallback to unknown when no IP is available', async () => {
      const req = { ip: undefined, socket: {}, headers: {} };
      const tracker = await (guard as any).getTracker(req, mockContext);
      expect(tracker).toBe('unknown');
    });
  });

  describe('shouldSkip', () => {
    it('should skip throttling for exempt tier', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('exempt');
      const mockCtx = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;
      const result = await guard.shouldSkip(mockCtx);
      expect(result).toBe(true);
    });

    it('should not skip throttling for non-exempt tiers', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('auth');
      const mockCtx = {
        getHandler: jest.fn().mockReturnValue(() => {}),
        getClass: jest.fn().mockReturnValue(class {}),
        switchToHttp: jest.fn(),
      } as unknown as ExecutionContext;
      const result = await guard.shouldSkip(mockCtx);
      expect(result).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return the custom error message', async () => {
      const message = await guard.getErrorMessage({} as any, {} as any);
      expect(message).toBe('Too many requests, please try again later');
    });
  });
});
