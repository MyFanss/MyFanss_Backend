import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhooksService, WEBHOOK_MAX_ATTEMPTS } from './webhooks.service';
import { WebhookEvent } from './webhook-event.entity';
import { AppLogger } from '../logger/app-logger.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let repo: any;
  let configService: { get: jest.Mock };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const originalFetch = global.fetch;

  beforeEach(async () => {
    repo = {
      create: jest.fn((data) => data as WebhookEvent),
      save: jest.fn(async (event) => event as WebhookEvent),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    configService = { get: jest.fn().mockReturnValue(undefined) };
    logger.log.mockReset();
    logger.warn.mockReset();
    logger.error.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: getRepositoryToken(WebhookEvent), useValue: repo },
        { provide: ConfigService, useValue: configService },
        { provide: AppLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(WebhooksService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('emit', () => {
    it('writes a pending event with a redacted payload via the default repository', async () => {
      const saved = await service.emit('subscription.created', {
        fanId: 1,
        creatorId: 2,
        email: 'fan@example.com',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'subscription.created',
          status: 'pending',
          attempts: 0,
          payload: expect.objectContaining({
            fanId: 1,
            creatorId: 2,
            email: '[REDACTED]',
          }),
        }),
      );
      expect(repo.save).toHaveBeenCalled();
      expect(saved.status).toBe('pending');
    });

    it('writes through the provided transaction manager instead of the default repository', async () => {
      const managerRepo = {
        create: jest.fn((data) => data),
        save: jest.fn(async (event) => event),
      };
      const manager = { getRepository: jest.fn().mockReturnValue(managerRepo) };

      await service.emit(
        'post.published',
        { postId: 1, creatorId: 2, visibility: 'public' },
        manager as any,
      );

      expect(manager.getRepository).toHaveBeenCalledWith(WebhookEvent);
      expect(managerRepo.create).toHaveBeenCalled();
      expect(managerRepo.save).toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('dispatch', () => {
    function pendingEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
      return {
        id: 'evt-1',
        eventType: 'post.published',
        payload: { postId: 1 },
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
        createdAt: new Date(),
        deliveredAt: null,
        ...overrides,
      } as WebhookEvent;
    }

    it('marks an event delivered on the success path (console sink, no debug URL)', async () => {
      repo.find.mockResolvedValue([pendingEvent()]);

      const outcome = await service.dispatch();

      expect(outcome).toEqual({
        processed: 1,
        delivered: 1,
        failed: 0,
        dead: 0,
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'delivered', lastError: null }),
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('post.published'),
        'WebhooksService',
      );
    });

    it('posts to WEBHOOK_DEBUG_URL and delivers on a 2xx response', async () => {
      configService.get.mockReturnValue('http://sink.local/webhooks');
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as unknown as typeof fetch;
      repo.find.mockResolvedValue([pendingEvent()]);

      const outcome = await service.dispatch();

      expect(fetchMock).toHaveBeenCalledWith(
        'http://sink.local/webhooks',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(outcome.delivered).toBe(1);
    });

    it('increments attempts and backs off when the sink responds non-2xx', async () => {
      configService.get.mockReturnValue('http://sink.local/webhooks');
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as typeof fetch;
      repo.find.mockResolvedValue([pendingEvent()]);

      const outcome = await service.dispatch();

      expect(outcome).toEqual({
        processed: 1,
        delivered: 0,
        failed: 1,
        dead: 0,
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          attempts: 1,
          lastError: expect.stringContaining('500'),
        }),
      );
      const savedEvent = repo.save.mock.calls[0][0] as WebhookEvent;
      expect(savedEvent.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('marks an event dead once it reaches the max attempt count', async () => {
      repo.find.mockResolvedValue([
        pendingEvent({ attempts: WEBHOOK_MAX_ATTEMPTS - 1 }),
      ]);
      configService.get.mockReturnValue('http://sink.local/webhooks');
      global.fetch = jest
        .fn()
        .mockRejectedValue(
          new Error('network down'),
        ) as unknown as typeof fetch;

      const outcome = await service.dispatch();

      expect(outcome).toEqual({
        processed: 1,
        delivered: 0,
        failed: 0,
        dead: 1,
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'dead',
          attempts: WEBHOOK_MAX_ATTEMPTS,
        }),
      );
    });

    it('processes each due event independently — one failing sink does not affect the others', async () => {
      configService.get.mockReturnValue('http://sink.local/webhooks');
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() => Promise.reject(new Error('boom')))
        .mockImplementationOnce(() =>
          Promise.resolve({ ok: true, status: 200 }),
        ) as unknown as typeof fetch;
      repo.find.mockResolvedValue([
        pendingEvent({ id: 'evt-1' }),
        pendingEvent({ id: 'evt-2' }),
      ]);

      const outcome = await service.dispatch();

      expect(outcome).toEqual({
        processed: 2,
        delivered: 1,
        failed: 1,
        dead: 0,
      });
    });

    it('only selects pending events at or before nextAttemptAt', async () => {
      repo.find.mockResolvedValue([]);

      await service.dispatch(5);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
          take: 5,
        }),
      );
    });
  });

  describe('retry', () => {
    it('resets a dead event back to pending', async () => {
      repo.findOne.mockResolvedValue({
        id: 'evt-1',
        status: 'dead',
        attempts: 5,
        lastError: 'boom',
      } as WebhookEvent);

      const result = await service.retry('evt-1');

      expect(result.status).toBe('pending');
      expect(result.attempts).toBe(0);
      expect(result.lastError).toBeNull();
    });

    it('throws NotFoundException for an unknown event id', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.retry('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ConflictException when the event is not dead', async () => {
      repo.findOne.mockResolvedValue({
        id: 'evt-1',
        status: 'pending',
      } as WebhookEvent);

      await expect(service.retry('evt-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('listEvents', () => {
    it('applies the status filter and pagination', async () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      repo.createQueryBuilder.mockReturnValue(qb as any);

      await service.listEvents({ status: 'dead', page: 2, limit: 10 });

      expect(qb.andWhere).toHaveBeenCalledWith('event.status = :status', {
        status: 'dead',
      });
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });
});
