import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from './subscription.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../mailer/mailer.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subscriptionRepo: jest.Mocked<Repository<Subscription>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let notificationsService: jest.Mocked<
    Pick<NotificationsService, 'shouldNotify'>
  >;
  let mailerService: jest.Mocked<
    Pick<MailerService, 'sendNewSubscriberNotification'>
  >;

  beforeEach(async () => {
    notificationsService = { shouldNotify: jest.fn().mockResolvedValue(true) };
    mailerService = {
      sendNewSubscriberNotification: jest
        .fn()
        .mockResolvedValue({ accepted: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: MailerService, useValue: mailerService },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
    subscriptionRepo = module.get(getRepositoryToken(Subscription));
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('subscribe', () => {
    it('rejects subscribing to yourself', async () => {
      await expect(
        service.subscribe(1, { creatorId: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFound when the creator does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.subscribe(1, { creatorId: 99 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates a new active subscription', async () => {
      userRepo.findOne.mockResolvedValue({ id: 2 } as User);
      subscriptionRepo.findOne.mockResolvedValue(null);
      const created = {
        fanId: 1,
        creatorId: 2,
        status: 'active',
        cancelledAt: null,
      } as Subscription;
      subscriptionRepo.create.mockReturnValue(created);
      subscriptionRepo.save.mockResolvedValue({
        ...created,
        id: 'uuid-1',
        subscribedAt: new Date(),
      });

      const result = await service.subscribe(1, { creatorId: 2 });

      expect(result).toMatchObject({
        id: 'uuid-1',
        fanId: 1,
        creatorId: 2,
        status: 'active',
        cancelledAt: null,
      });
      expect(subscriptionRepo.create).toHaveBeenCalled();
    });

    it('returns 409 when an active subscription already exists', async () => {
      userRepo.findOne.mockResolvedValue({ id: 2 } as User);
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        fanId: 1,
        creatorId: 2,
        status: 'active',
      } as Subscription);

      await expect(
        service.subscribe(1, { creatorId: 2 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(subscriptionRepo.save).not.toHaveBeenCalled();
    });

    it('reactivates a previously cancelled subscription', async () => {
      userRepo.findOne.mockResolvedValue({ id: 2 } as User);
      const cancelled = {
        id: 'uuid-1',
        fanId: 1,
        creatorId: 2,
        status: 'cancelled',
        cancelledAt: new Date('2020-01-01'),
        subscribedAt: new Date('2019-01-01'),
      } as Subscription;
      subscriptionRepo.findOne.mockResolvedValue(cancelled);
      subscriptionRepo.save.mockImplementation(async (s) => s as Subscription);

      const result = await service.subscribe(1, { creatorId: 2 });

      expect(result.status).toBe('active');
      expect(result.cancelledAt).toBeNull();
      expect(subscriptionRepo.create).not.toHaveBeenCalled();
      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'uuid-1', status: 'active' }),
      );
    });
  });

  describe('new subscriber mail notification', () => {
    const creator = {
      id: 2,
      name: 'Creator',
      email: 'creator@example.com',
    } as User;

    it('sends creator mail when preferences.newSubscriber is true', async () => {
      userRepo.findOne.mockResolvedValue(creator);
      subscriptionRepo.findOne.mockResolvedValue(null);
      subscriptionRepo.create.mockReturnValue({
        fanId: 1,
        creatorId: 2,
        status: 'active',
        cancelledAt: null,
      } as Subscription);
      subscriptionRepo.save.mockResolvedValue({
        id: 'uuid-1',
        fanId: 1,
        creatorId: 2,
        status: 'active',
        cancelledAt: null,
        subscribedAt: new Date(),
      } as Subscription);
      notificationsService.shouldNotify.mockResolvedValue(true);

      await service.subscribe(1, { creatorId: 2 });

      expect(notificationsService.shouldNotify).toHaveBeenCalledWith(
        2,
        'newSubscriber',
      );
      expect(mailerService.sendNewSubscriberNotification).toHaveBeenCalledWith(
        creator.email,
        expect.objectContaining({ creatorName: creator.name }),
      );
    });

    it('does not send creator mail when preferences.newSubscriber is false', async () => {
      userRepo.findOne.mockResolvedValue(creator);
      subscriptionRepo.findOne.mockResolvedValue(null);
      subscriptionRepo.create.mockReturnValue({
        fanId: 1,
        creatorId: 2,
        status: 'active',
        cancelledAt: null,
      } as Subscription);
      subscriptionRepo.save.mockResolvedValue({
        id: 'uuid-1',
        fanId: 1,
        creatorId: 2,
        status: 'active',
        cancelledAt: null,
        subscribedAt: new Date(),
      } as Subscription);
      notificationsService.shouldNotify.mockResolvedValue(false);

      await service.subscribe(1, { creatorId: 2 });

      expect(
        mailerService.sendNewSubscriberNotification,
      ).not.toHaveBeenCalled();
    });

    it('still returns the subscription when the mailer throws', async () => {
      userRepo.findOne.mockResolvedValue(creator);
      subscriptionRepo.findOne.mockResolvedValue(null);
      subscriptionRepo.create.mockReturnValue({
        fanId: 1,
        creatorId: 2,
        status: 'active',
        cancelledAt: null,
      } as Subscription);
      subscriptionRepo.save.mockResolvedValue({
        id: 'uuid-1',
        fanId: 1,
        creatorId: 2,
        status: 'active',
        cancelledAt: null,
        subscribedAt: new Date(),
      } as Subscription);
      notificationsService.shouldNotify.mockResolvedValue(true);
      mailerService.sendNewSubscriberNotification.mockRejectedValue(
        new Error('SMTP down'),
      );

      const result = await service.subscribe(1, { creatorId: 2 });

      expect(result).toMatchObject({ id: 'uuid-1', status: 'active' });
    });
  });

  describe('cancel', () => {
    it('cancels an active subscription', async () => {
      const active = {
        id: 'uuid-1',
        fanId: 1,
        creatorId: 2,
        status: 'active',
        cancelledAt: null,
      } as Subscription;
      subscriptionRepo.findOne.mockResolvedValue(active);
      subscriptionRepo.save.mockImplementation(async (s) => s as Subscription);

      const result = await service.cancel(1, 2);

      expect(result.status).toBe('cancelled');
      expect(result.cancelledAt).toBeInstanceOf(Date);
    });

    it('throws NotFound when there is no active subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(service.cancel(1, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('listMySubscriptions', () => {
    it('returns only active subscriptions with pagination meta', async () => {
      subscriptionRepo.findAndCount.mockResolvedValue([
        [
          {
            id: 'uuid-1',
            fanId: 1,
            creatorId: 2,
            status: 'active',
            subscribedAt: new Date(),
            cancelledAt: null,
          } as Subscription,
        ],
        1,
      ]);

      const result = await service.listMySubscriptions(1, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toMatchObject({
        totalCount: 1,
        limit: 20,
        hasMore: false,
      });
      expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fanId: 1, status: 'active' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('reports hasMore when more pages exist', async () => {
      subscriptionRepo.findAndCount.mockResolvedValue([[], 50]);

      const result = await service.listMySubscriptions(1, {
        page: 1,
        limit: 20,
      });

      expect(result.pagination.hasMore).toBe(true);
    });
  });

  describe('listMySubscribers', () => {
    it('returns subscriber ids and count for the creator', async () => {
      subscriptionRepo.findAndCount.mockResolvedValue([
        [
          {
            id: 'uuid-1',
            fanId: 7,
            creatorId: 2,
            status: 'active',
            subscribedAt: new Date(),
            cancelledAt: null,
          } as Subscription,
        ],
        1,
      ]);

      const result = await service.listMySubscribers(2, { page: 1, limit: 20 });

      expect(result.data).toEqual([
        expect.objectContaining({ id: 'uuid-1', fanId: 7 }),
      ]);
      expect(result.pagination.totalCount).toBe(1);
      expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { creatorId: 2, status: 'active' },
        }),
      );
    });
  });

  describe('isActiveSubscriber', () => {
    it('returns true when an active subscription row exists', async () => {
      subscriptionRepo.count.mockResolvedValue(1);

      const result = await service.isActiveSubscriber(1, 2);

      expect(result).toBe(true);
      expect(subscriptionRepo.count).toHaveBeenCalledWith({
        where: { fanId: 1, creatorId: 2, status: 'active' },
      });
    });

    it('returns false when there is no active subscription row', async () => {
      subscriptionRepo.count.mockResolvedValue(0);

      const result = await service.isActiveSubscriber(1, 2);

      expect(result).toBe(false);
    });

    it('returns false for a cancelled subscription (count excludes it)', async () => {
      // The `status: 'active'` filter in the count query is what excludes a
      // cancelled row; this asserts the service never widens that filter.
      subscriptionRepo.count.mockResolvedValue(0);

      const result = await service.isActiveSubscriber(1, 2);

      expect(result).toBe(false);
      expect(subscriptionRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        }),
      );
    });
  });
});
