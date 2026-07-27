import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ModerationService } from './moderation.service';
import { ReportTargetType } from './enums/report-target-type.enum';
import { ReportStatus } from './enums/report-status.enum';

describe('ReportsController', () => {
  let controller: ReportsController;

  const mockService = {
    createReport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ModerationService, useValue: mockService }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates report creation to the service with the authenticated reporter id', async () => {
    const dto = {
      targetType: ReportTargetType.POST,
      targetId: 42,
      reason: 'Spam',
    };
    const created = { id: 1, ...dto, status: ReportStatus.OPEN };
    mockService.createReport.mockResolvedValue(created);

    const result = await controller.createReport(dto, 9);

    expect(mockService.createReport).toHaveBeenCalledWith(9, dto);
    expect(result).toEqual(created);
  });
});
