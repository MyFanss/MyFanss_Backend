import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { CreatorAnalyticsService } from './creator-analytics.service';
import { Subscription } from '../subscriptions/subscription.entity';

const createQueryBuilderMock = () => {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  return qb;
};

describe('CreatorAnalyticsService', () => {
  let service: CreatorAnalyticsService;
  let repo: jest.Mocked<Repository<Subscription>>;
  let cacheManager: { get: jest.Mock; set: jest.Mock };
  let qb: any;

  beforeEach(async () => {
    qb = createQueryBuilderMock();
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    } as any;

    cacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorAnalyticsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: repo,
        },
        {
          provide: 'CACHE_MANAGER',
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get<CreatorAnalyticsService>(CreatorAnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns cached analytics when available', async () => {
    const cached = {
      subscriberCount: 10,
      newSubscribers: 2,
      churnedSubscribers: 1,
      periodDays: 30,
      topReferrers: [],
    };
    cacheManager.get.mockResolvedValue(cached);

    const result = await service.getCreatorAnalytics(1, 30);

    expect(result).toEqual(cached);
    expect(cacheManager.get).toHaveBeenCalledWith('creator-analytics:1:30');
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('computes analytics counts and caches the result', async () => {
    const activeCount = [{ count: '4' }];
    const newCount = [{ count: '2' }];
    const churnCount = [{ count: '1' }];
    const referrers = [
      { referrer: 'social', count: '3' },
      { referrer: 'email', count: '1' },
    ];

    const getRawManyMock = jest.fn()
      .mockResolvedValueOnce(activeCount)
      .mockResolvedValueOnce(newCount)
      .mockResolvedValueOnce(churnCount)
      .mockResolvedValueOnce(referrers);

    qb.getRawMany = getRawManyMock;

    const result = await service.getCreatorAnalytics(5, 30);

    expect(result).toEqual({
      subscriberCount: 4,
      newSubscribers: 2,
      churnedSubscribers: 1,
      periodDays: 30,
      topReferrers: [
        { referrer: 'social', count: 3 },
        { referrer: 'email', count: 1 },
      ],
    });
    expect(cacheManager.set).toHaveBeenCalledWith(
      'creator-analytics:5:30',
      result,
      60,
    );
  });
});
