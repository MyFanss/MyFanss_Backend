import { Test, TestingModule } from '@nestjs/testing';
import { AdminReportsController } from './admin-reports.controller';
import { ModerationService } from './moderation.service';
import { ReportStatus } from './enums/report-status.enum';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('AdminReportsController', () => {
  let controller: AdminReportsController;

  const mockService = {
    findReports: jest.fn(),
    resolveReport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminReportsController],
      providers: [{ provide: ModerationService, useValue: mockService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminReportsController>(AdminReportsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getReports', () => {
    it('returns paginated reports with computed pagination metadata', async () => {
      mockService.findReports.mockResolvedValue({
        data: [{ id: 1, status: ReportStatus.OPEN }],
        total: 1,
        page: 1,
        limit: 20,
      });

      const result = await controller.getReports({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        hasMore: false,
        totalCount: 1,
        limit: 20,
      });
    });
  });

  describe('updateReport', () => {
    it('resolves a report with the authenticated admin as actor', async () => {
      const updated = {
        id: 1,
        status: ReportStatus.RESOLVED,
        resolvedBy: 3,
      };
      mockService.resolveReport.mockResolvedValue(updated);

      const result = await controller.updateReport(
        1,
        { status: ReportStatus.RESOLVED },
        3,
      );

      expect(mockService.resolveReport).toHaveBeenCalledWith(1, 3, {
        status: ReportStatus.RESOLVED,
      });
      expect(result).toEqual(updated);
    });
  });
});
