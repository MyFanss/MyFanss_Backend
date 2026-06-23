import { Test, TestingModule } from '@nestjs/testing';
import { CreatorAnalyticsController } from './creator-analytics.controller';
import { CreatorAnalyticsService } from './creator-analytics.service';

describe('CreatorAnalyticsController', () => {
  let controller: CreatorAnalyticsController;
  let service: CreatorAnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreatorAnalyticsController],
      providers: [
        {
          provide: CreatorAnalyticsService,
          useValue: {
            getCreatorAnalytics: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CreatorAnalyticsController>(
      CreatorAnalyticsController,
    );
    service = module.get<CreatorAnalyticsService>(CreatorAnalyticsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns analytics wrapped in data property', async () => {
    const analytics = {
      subscriberCount: 120,
      newSubscribers: 15,
      churnedSubscribers: 3,
      periodDays: 30,
      topReferrers: [],
    };

    (service.getCreatorAnalytics as jest.Mock).mockResolvedValue(analytics);

    const result = await controller.getAnalytics(
      { user: { id: 10, email: 'creator1@dev.local', role: 'creator' } },
      { days: 30 },
    );

    expect(result).toEqual({ data: analytics });
    expect(service.getCreatorAnalytics).toHaveBeenCalledWith(10, 30);
  });
});
