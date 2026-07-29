import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: jest.Mocked<Pick<HealthCheckService, 'check'>>;
  let dbIndicator: jest.Mocked<Pick<TypeOrmHealthIndicator, 'pingCheck'>>;

  beforeEach(async () => {
    healthCheckService = {
      check: jest.fn(),
    };
    dbIndicator = {
      pingCheck: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: dbIndicator },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkLiveness', () => {
    it('should return status ok with a timestamp', () => {
      const result = controller.checkLiveness();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should not call any database health checks', () => {
      controller.checkLiveness();
      expect(healthCheckService.check).not.toHaveBeenCalled();
    });
  });

  describe('checkReadiness', () => {
    it('should call the health check service with a database ping check', async () => {
      const expectedResult: HealthCheckResult = {
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      };
      healthCheckService.check.mockResolvedValue(expectedResult);

      const result = await controller.checkReadiness();
      expect(result).toEqual(expectedResult);
      expect(healthCheckService.check).toHaveBeenCalledTimes(1);
    });

    it('should pass health indicator functions to health.check', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      };
      healthCheckService.check.mockResolvedValue(mockResult);

      await controller.checkReadiness();

      expect(healthCheckService.check).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Function)]),
      );
    });
  });
});
