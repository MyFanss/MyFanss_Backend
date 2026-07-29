import { ConsoleMailerAdapter } from './console-mailer.adapter';
import { AppLogger } from '../../logger/app-logger.service';

describe('ConsoleMailerAdapter', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let logger: jest.Mocked<Pick<AppLogger, 'log'>>;

  beforeEach(() => {
    logger = { log: jest.fn() };
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('logs the full email content in non-production environments', async () => {
    process.env.NODE_ENV = 'development';
    const adapter = new ConsoleMailerAdapter(logger as unknown as AppLogger);
    const token = 'a'.repeat(64);

    const result = await adapter.send({
      to: 'jeremiah@example.com',
      subject: 'Reset your password',
      html: '<p>hi</p>',
      text: `Use this token: ${token}`,
    });

    expect(result.accepted).toBe(true);
    const loggedMessage = logger.log.mock.calls[0][0] as string;
    expect(loggedMessage).toContain('jeremiah@example.com');
    expect(loggedMessage).toContain(token);
  });

  it('redacts the recipient email and long tokens in production', async () => {
    process.env.NODE_ENV = 'production';
    const adapter = new ConsoleMailerAdapter(logger as unknown as AppLogger);
    const token = 'a'.repeat(64);

    await adapter.send({
      to: 'jeremiah@example.com',
      subject: 'Reset your password',
      html: '<p>hi</p>',
      text: `Use this token: ${token}`,
    });

    const loggedMessage = logger.log.mock.calls[0][0] as string;
    expect(loggedMessage).not.toContain('jeremiah@example.com');
    expect(loggedMessage).not.toContain(token);
    expect(loggedMessage).toContain('[REDACTED]');
  });
});
