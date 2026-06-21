import { AppLogger } from './app-logger.service';
import winstonLogger from './app-logger.service';
import { runWithRequestContext } from '../common/request-context/request-context.storage';

describe('AppLogger', () => {
  let logger: AppLogger;

  beforeEach(() => {
    logger = new AppLogger();
  });

  it('includes requestId in log metadata when request context is set', () => {
    const infoSpy = jest.spyOn(winstonLogger, 'info');

    runWithRequestContext({ requestId: 'test-request-id' }, () => {
      logger.log('hello', 'TestContext');
    });

    expect(infoSpy).toHaveBeenCalledWith('hello', {
      context: 'TestContext',
      requestId: 'test-request-id',
    });

    infoSpy.mockRestore();
  });

  it('omits requestId when no request context is set', () => {
    const infoSpy = jest.spyOn(winstonLogger, 'info');

    logger.log('hello', 'TestContext');

    expect(infoSpy).toHaveBeenCalledWith('hello', {
      context: 'TestContext',
    });

    infoSpy.mockRestore();
  });
});
