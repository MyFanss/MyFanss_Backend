import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { SubscriptionsController } from './subscriptions.controller';
import { CreatorsController } from './creators.controller';
import { SubscriptionsService } from './subscriptions.service';

interface AuthenticatedRequest extends Request {
  user: { userId: number; email: string; username: string };
}

const reqFor = (userId: number) =>
  ({ user: { userId, email: 'x', username: 'x' } }) as AuthenticatedRequest;

describe('Subscription controllers', () => {
  let subscriptionsController: SubscriptionsController;
  let creatorsController: CreatorsController;
  let service: jest.Mocked<SubscriptionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController, CreatorsController],
      providers: [
        {
          provide: SubscriptionsService,
          useValue: {
            subscribe: jest.fn(),
            cancel: jest.fn(),
            listMySubscriptions: jest.fn(),
            listMySubscribers: jest.fn(),
          },
        },
      ],
    }).compile();

    subscriptionsController = module.get(SubscriptionsController);
    creatorsController = module.get(CreatorsController);
    service = module.get(SubscriptionsService);
  });

  it('subscribe passes the authenticated fan id to the service', async () => {
    (service.subscribe as jest.Mock).mockResolvedValue({ id: 'a' });

    await subscriptionsController.subscribe(reqFor(5), { creatorId: 9 });

    expect(service.subscribe).toHaveBeenCalledWith(5, { creatorId: 9 });
  });

  it('cancel passes the authenticated fan id and creator id', async () => {
    (service.cancel as jest.Mock).mockResolvedValue({ id: 'a' });

    await subscriptionsController.cancel(reqFor(5), 9);

    expect(service.cancel).toHaveBeenCalledWith(5, 9);
  });

  it('listMySubscriptions uses the authenticated user id', async () => {
    (service.listMySubscriptions as jest.Mock).mockResolvedValue({
      data: [],
      pagination: { hasMore: false, totalCount: 0, limit: 20 },
    });

    await subscriptionsController.listMySubscriptions(reqFor(5), {
      page: 1,
      limit: 20,
    });

    expect(service.listMySubscriptions).toHaveBeenCalledWith(5, {
      page: 1,
      limit: 20,
    });
  });

  it('listMySubscribers scopes to the authenticated creator (ownership)', async () => {
    (service.listMySubscribers as jest.Mock).mockResolvedValue({
      data: [],
      pagination: { hasMore: false, totalCount: 0, limit: 20 },
    });

    await creatorsController.listMySubscribers(reqFor(5), {
      page: 1,
      limit: 20,
    });

    expect(service.listMySubscribers).toHaveBeenCalledWith(5, {
      page: 1,
      limit: 20,
    });
  });
});
