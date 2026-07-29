import { ConfigService } from '@nestjs/config';
import { MailerService } from './mailer.service';
import { MailerPort, SendMailResult } from './mailer.port';
import { EmailOutbox } from './email-outbox.port';
import { MailerMetrics } from './mailer-metrics.service';
import { AppLogger } from '../logger/app-logger.service';

describe('MailerService', () => {
  let mailerPort: jest.Mocked<MailerPort>;
  let outbox: jest.Mocked<EmailOutbox>;
  let metrics: MailerMetrics;
  let logger: jest.Mocked<Pick<AppLogger, 'error'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let service: MailerService;

  beforeEach(() => {
    mailerPort = { send: jest.fn() };
    outbox = { record: jest.fn().mockResolvedValue(undefined) };
    metrics = new MailerMetrics();
    logger = { error: jest.fn() };
    configService = { get: jest.fn().mockReturnValue(undefined) };

    service = new MailerService(
      mailerPort,
      outbox,
      metrics,
      logger as unknown as AppLogger,
      configService as unknown as ConfigService,
    );
  });

  it('sends mail and records a "sent" outbox row on success', async () => {
    const okResult: SendMailResult = { accepted: true, messageId: 'abc' };
    mailerPort.send.mockResolvedValue(okResult);

    const result = await service.send({
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>hi</p>',
      text: 'hi',
      tags: { template: 'password-reset' },
    });

    expect(result).toEqual(okResult);
    expect(outbox.record).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent' }),
    );
    expect(metrics.snapshot().sent).toBe(1);
  });

  it('swallows a mailer throw, records a "failed" outbox row, and returns accepted:false', async () => {
    mailerPort.send.mockRejectedValue(new Error('SMTP down'));

    const result = await service.send({
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>hi</p>',
      text: 'hi',
    });

    expect(result).toEqual({ accepted: false });
    expect(outbox.record).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: 'SMTP down' }),
    );
    expect(metrics.snapshot().failed).toBe(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it('treats a send that exceeds the timeout as a failure', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'MAILER_TIMEOUT_MS' ? 10 : undefined,
    );
    service = new MailerService(
      mailerPort,
      outbox,
      metrics,
      logger as unknown as AppLogger,
      configService as unknown as ConfigService,
    );
    mailerPort.send.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ accepted: true }), 200),
        ),
    );

    const result = await service.send({
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>hi</p>',
      text: 'hi',
    });

    expect(result).toEqual({ accepted: false });
    expect(metrics.snapshot().failed).toBe(1);
  });

  it('builds and sends the password reset template', async () => {
    mailerPort.send.mockResolvedValue({ accepted: true });

    await service.sendPasswordReset('user@example.com', {
      name: 'Jane',
      resetUrl: 'https://app.test/reset?token=abc',
    });

    expect(mailerPort.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Reset your password',
        tags: { template: 'password-reset' },
      }),
    );
  });

  it('builds and sends the new subscriber template', async () => {
    mailerPort.send.mockResolvedValue({ accepted: true });

    await service.sendNewSubscriberNotification('creator@example.com', {
      creatorName: 'Creator',
      subscriberName: 'Fan',
    });

    expect(mailerPort.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'creator@example.com',
        subject: 'You have a new subscriber',
        tags: { template: 'new-subscriber' },
      }),
    );
  });
});
