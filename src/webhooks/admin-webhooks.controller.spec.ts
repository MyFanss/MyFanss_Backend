import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { AdminWebhooksController } from './admin-webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/enums/role.enum';

describe('AdminWebhooksController', () => {
  let controller: AdminWebhooksController;
  let webhooksService: jest.Mocked<
    Pick<WebhooksService, 'listEvents' | 'dispatch' | 'retry'>
  >;

  beforeEach(async () => {
    webhooksService = {
      listEvents: jest.fn(),
      dispatch: jest.fn(),
      retry: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminWebhooksController],
      providers: [{ provide: WebhooksService, useValue: webhooksService }],
    }).compile();

    controller = module.get(AdminWebhooksController);
  });

  it('lists webhook events with pagination metadata', async () => {
    webhooksService.listEvents.mockResolvedValue({
      data: [
        {
          id: 'evt-1',
          eventType: 'post.published',
          payload: { postId: 1 },
          status: 'delivered',
          attempts: 0,
          nextAttemptAt: new Date(),
          lastError: null,
          createdAt: new Date(),
          deliveredAt: new Date(),
        } as any,
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.listEvents({ page: 1, limit: 20 } as any);

    expect(result.data).toHaveLength(1);
    expect(result.pagination).toMatchObject({ totalCount: 1, limit: 20 });
  });

  it('triggers dispatch and returns the outcome counts', async () => {
    webhooksService.dispatch.mockResolvedValue({
      processed: 2,
      delivered: 1,
      failed: 1,
      dead: 0,
    });

    const result = await controller.dispatch();

    expect(webhooksService.dispatch).toHaveBeenCalled();
    expect(result).toEqual({ processed: 2, delivered: 1, failed: 1, dead: 0 });
  });

  it('retries a dead event', async () => {
    webhooksService.retry.mockResolvedValue({
      id: 'evt-1',
      eventType: 'post.published',
      payload: {},
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      createdAt: new Date(),
      deliveredAt: null,
    } as any);

    const result = await controller.retry('evt-1');

    expect(webhooksService.retry).toHaveBeenCalledWith('evt-1');
    expect(result.status).toBe('pending');
  });

  it('denies non-admin roles via RolesGuard', () => {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    const guard = new RolesGuard(reflector);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: UserRole.FAN } }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow();
  });
});
