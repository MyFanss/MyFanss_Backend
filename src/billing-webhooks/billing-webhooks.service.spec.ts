import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BillingWebhooksService } from './billing-webhooks.service';
import { BillingWebhookEvent } from './billing-webhook-event.entity';
import { AuditService } from '../audit/audit.service';
import { AppLogger } from '../logger/app-logger.service';
import { signBillingWebhookPayload } from './billing-webhook-signature';

describe('BillingWebhooksService (unit)', () => {
  let service: BillingWebhooksService;
  let configService: { get: jest.Mock };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  beforeEach(async () => {
    configService = { get: jest.fn() };
    logger.log.mockReset();
    logger.warn.mockReset();
    logger.error.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingWebhooksService,
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn() },
        },
        {
          provide: getRepositoryToken(BillingWebhookEvent),
          useValue: { findOne: jest.fn(), increment: jest.fn() },
        },
        { provide: ConfigService, useValue: configService },
        { provide: AppLogger, useValue: logger },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(BillingWebhooksService);
  });

  it('rejects an empty body', async () => {
    configService.get.mockReturnValue(undefined);
    await expect(
      service.handleIncoming(Buffer.alloc(0), undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a body larger than the configured max size', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'BILLING_WEBHOOK_SECRET' ? undefined : 'test',
    );
    const oversized = Buffer.alloc(70 * 1024, 'a');
    await expect(
      service.handleIncoming(oversized, undefined),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('rejects malformed JSON bodies', async () => {
    configService.get.mockReturnValue(undefined);
    await expect(
      service.handleIncoming(Buffer.from('not json'), undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects payloads missing id/type', async () => {
    configService.get.mockReturnValue(undefined);
    await expect(
      service.handleIncoming(
        Buffer.from(JSON.stringify({ foo: 'bar' })),
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logs a loud warning and accepts requests when no secret is configured in dev', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'development';
      return undefined;
    });

    // Force downstream DB work to fail fast — we only care that signature
    // verification did not itself reject the request first.
    const dataSource = service['dataSource'] as jest.Mocked<DataSource>;
    (dataSource.createQueryRunner as jest.Mock).mockReturnValue({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: { save: jest.fn().mockRejectedValue(new Error('boom')) },
    });

    await expect(
      service.handleIncoming(
        Buffer.from(JSON.stringify({ id: 'evt_1', type: 'unknown.type' })),
        undefined,
      ),
    ).rejects.toThrow('boom');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('BILLING_WEBHOOK_SECRET is not set'),
      expect.any(String),
    );
  });

  it('rejects with 401 in production when no secret is configured', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'NODE_ENV' ? 'production' : undefined,
    );

    await expect(
      service.handleIncoming(
        Buffer.from(
          JSON.stringify({ id: 'evt_1', type: 'subscription.activated' }),
        ),
        undefined,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects with 401 when the signature does not verify', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'BILLING_WEBHOOK_SECRET' ? 'whsec_test' : undefined,
    );

    const rawBody = Buffer.from(
      JSON.stringify({ id: 'evt_1', type: 'subscription.activated' }),
    );
    const badSignature = signBillingWebhookPayload(rawBody, 'wrong-secret');

    await expect(
      service.handleIncoming(rawBody, badSignature),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a validly signed payload and proceeds to processing', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'BILLING_WEBHOOK_SECRET' ? 'whsec_test' : undefined,
    );

    const dataSource = service['dataSource'] as jest.Mocked<DataSource>;
    (dataSource.createQueryRunner as jest.Mock).mockReturnValue({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: { save: jest.fn().mockRejectedValue(new Error('downstream')) },
    });

    const rawBody = Buffer.from(
      JSON.stringify({ id: 'evt_1', type: 'subscription.activated' }),
    );
    const goodSignature = signBillingWebhookPayload(rawBody, 'whsec_test');

    await expect(
      service.handleIncoming(rawBody, goodSignature),
    ).rejects.toThrow('downstream');
  });
});
