import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { AppLogger } from '../logger/app-logger.service';
import { ConsoleMailerAdapter } from './adapters/console-mailer.adapter';
import { SmtpMailerAdapter } from './adapters/smtp-mailer.adapter';
import { MAILER_PORT, MailerPort } from './mailer.port';
import { EMAIL_OUTBOX } from './email-outbox.port';
import { InMemoryEmailOutbox } from './email-outbox.service';
import { MailerMetrics } from './mailer-metrics.service';
import { MailerService } from './mailer.service';

export type MailerDriver = 'console' | 'smtp';

function resolveDriver(configService: ConfigService): MailerDriver {
  const raw = (configService.get<string>('MAILER_DRIVER') ?? 'console')
    .trim()
    .toLowerCase();
  return raw === 'smtp' ? 'smtp' : 'console';
}

const mailerPortProvider: Provider = {
  provide: MAILER_PORT,
  useFactory: (configService: ConfigService, logger: AppLogger): MailerPort => {
    const driver = resolveDriver(configService);

    if (driver === 'smtp') {
      return new SmtpMailerAdapter(
        {
          host: configService.get<string>('SMTP_HOST') ?? 'localhost',
          port: configService.get<number>('SMTP_PORT') ?? 587,
          secure: configService.get<string>('SMTP_SECURE') === 'true',
          auth: configService.get<string>('SMTP_USER')
            ? {
                user: configService.get<string>('SMTP_USER') ?? '',
                pass: configService.get<string>('SMTP_PASS') ?? '',
              }
            : undefined,
          from:
            configService.get<string>('SMTP_FROM') ?? 'no-reply@myfans.local',
        },
        logger,
      );
    }

    return new ConsoleMailerAdapter(logger);
  },
  inject: [ConfigService, AppLogger],
};

@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [
    MailerMetrics,
    mailerPortProvider,
    { provide: EMAIL_OUTBOX, useClass: InMemoryEmailOutbox },
    MailerService,
  ],
  exports: [MailerService],
})
export class MailerModule {}
