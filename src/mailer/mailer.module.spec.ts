import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerModule } from './mailer.module';
import { MAILER_PORT, MailerPort } from './mailer.port';
import { ConsoleMailerAdapter } from './adapters/console-mailer.adapter';
import { SmtpMailerAdapter } from './adapters/smtp-mailer.adapter';

describe('MailerModule driver selection', () => {
  async function buildMailerPort(
    driver: string | undefined,
  ): Promise<MailerPort> {
    const configServiceMock: Pick<ConfigService, 'get'> = {
      get: jest.fn((key: string) =>
        key === 'MAILER_DRIVER' ? driver : undefined,
      ) as ConfigService['get'],
    };

    const moduleRef = await Test.createTestingModule({
      imports: [MailerModule],
    })
      .overrideProvider(ConfigService)
      .useValue(configServiceMock)
      .compile();

    return moduleRef.get<MailerPort>(MAILER_PORT, { strict: false });
  }

  it('defaults to ConsoleMailerAdapter when MAILER_DRIVER is unset', async () => {
    const port = await buildMailerPort(undefined);
    expect(port).toBeInstanceOf(ConsoleMailerAdapter);
  });

  it('selects ConsoleMailerAdapter for MAILER_DRIVER=console', async () => {
    const port = await buildMailerPort('console');
    expect(port).toBeInstanceOf(ConsoleMailerAdapter);
  });

  it('selects SmtpMailerAdapter for MAILER_DRIVER=smtp', async () => {
    const port = await buildMailerPort('smtp');
    expect(port).toBeInstanceOf(SmtpMailerAdapter);
  });
});
