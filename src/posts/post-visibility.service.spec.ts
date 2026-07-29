import { Test, TestingModule } from '@nestjs/testing';
import { PostVisibilityService } from './post-visibility.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Post } from './post.entity';

describe('PostVisibilityService', () => {
  let service: PostVisibilityService;
  let subscriptionsService: jest.Mocked<
    Pick<SubscriptionsService, 'isActiveSubscriber'>
  >;

  beforeEach(async () => {
    subscriptionsService = { isActiveSubscriber: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostVisibilityService,
        { provide: SubscriptionsService, useValue: subscriptionsService },
      ],
    }).compile();

    service = module.get(PostVisibilityService);
  });

  const post = (visibility: 'public' | 'subscribers') =>
    ({ visibility }) as Post;

  describe('canViewPost — public posts', () => {
    it('are visible to anonymous callers', async () => {
      const result = await service.canViewPost(post('public'), undefined, 7);
      expect(result).toBe(true);
      expect(subscriptionsService.isActiveSubscriber).not.toHaveBeenCalled();
    });

    it('are visible to any authenticated caller regardless of subscription', async () => {
      const result = await service.canViewPost(
        post('public'),
        { userId: 1 },
        7,
      );
      expect(result).toBe(true);
      expect(subscriptionsService.isActiveSubscriber).not.toHaveBeenCalled();
    });
  });

  describe('canViewPost — subscribers-only posts', () => {
    it('are hidden from anonymous callers', async () => {
      const result = await service.canViewPost(
        post('subscribers'),
        undefined,
        7,
      );
      expect(result).toBe(false);
    });

    it('are visible to the owning creator without a subscription check', async () => {
      const result = await service.canViewPost(
        post('subscribers'),
        { userId: 7 },
        7,
      );
      expect(result).toBe(true);
      expect(subscriptionsService.isActiveSubscriber).not.toHaveBeenCalled();
    });

    it('are visible to a fan with an active subscription', async () => {
      subscriptionsService.isActiveSubscriber.mockResolvedValue(true);

      const result = await service.canViewPost(
        post('subscribers'),
        { userId: 1 },
        7,
      );

      expect(result).toBe(true);
      expect(subscriptionsService.isActiveSubscriber).toHaveBeenCalledWith(
        1,
        7,
      );
    });

    it('are hidden from a fan with no active subscription (e.g. cancelled)', async () => {
      subscriptionsService.isActiveSubscriber.mockResolvedValue(false);

      const result = await service.canViewPost(
        post('subscribers'),
        { userId: 1 },
        7,
      );

      expect(result).toBe(false);
    });
  });

  describe('canViewSubscriberContent', () => {
    it('returns false for an anonymous viewer', async () => {
      const result = await service.canViewSubscriberContent(undefined, 7);
      expect(result).toBe(false);
    });

    it('returns true for the owner without querying subscriptions', async () => {
      const result = await service.canViewSubscriberContent({ userId: 7 }, 7);
      expect(result).toBe(true);
      expect(subscriptionsService.isActiveSubscriber).not.toHaveBeenCalled();
    });

    it('delegates to SubscriptionsService for a non-owner viewer', async () => {
      subscriptionsService.isActiveSubscriber.mockResolvedValue(true);

      const result = await service.canViewSubscriberContent({ userId: 1 }, 7);

      expect(result).toBe(true);
      expect(subscriptionsService.isActiveSubscriber).toHaveBeenCalledWith(
        1,
        7,
      );
    });
  });
});
