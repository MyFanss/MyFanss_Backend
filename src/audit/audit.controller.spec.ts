import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLog } from './audit.entity';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { AdminGuard } from './admin.guard';

describe('AuditController', () => {
  let controller: AuditController;

  const mockService = {
    findLogs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuditController>(AuditController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs: Partial<AuditLog>[] = [
        {
          id: 1,
          action: 'USER_DELETED',
          targetType: 'User',
          targetId: 42,
          actorId: 1,
          createdAt: new Date(),
          metadata: null,
          ipAddress: null,
        },
      ];

      mockService.findLogs.mockResolvedValue({
        data: mockLogs,
        total: 1,
        page: 1,
        limit: 20,
      });

      const query: QueryAuditLogsDto = { page: 1, limit: 20 };
      const result = await controller.getAuditLogs(query);

      expect(result.data).toEqual(mockLogs);
      expect(result.pagination).toEqual({
        hasMore: false,
        totalCount: 1,
        limit: 20,
      });
    });

    it('should pass query params to service', async () => {
      mockService.findLogs.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const query: QueryAuditLogsDto = {
        action: 'USER_DELETED',
        actorId: 1,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        page: 1,
        limit: 20,
      };

      await controller.getAuditLogs(query);

      expect(mockService.findLogs).toHaveBeenCalledWith(query);
    });
  });
});
