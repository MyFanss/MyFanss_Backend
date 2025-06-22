import { Injectable, LoggerService as NestLoggerService, LogLevel } from '@nestjs/common';
import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

const winstonLogger: WinstonLogger = createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction
    ? format.json()
    : format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ timestamp, level, message, context, ...meta }) => {
          return `${timestamp} [${level}]${context ? ' [' + context + ']' : ''}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        }),
      ),
  transports: [new transports.Console()],
});

@Injectable()
export class AppLogger implements NestLoggerService {
  log(message: any, context?: string) {
    winstonLogger.info(message, { context });
  }
  error(message: any, trace?: string, context?: string) {
    winstonLogger.error(message, { trace, context });
  }
  warn(message: any, context?: string) {
    winstonLogger.warn(message, { context });
  }
  debug?(message: any, context?: string) {
    winstonLogger.debug(message, { context });
  }
  verbose?(message: any, context?: string) {
    winstonLogger.verbose(message, { context });
  }
  setLogLevels?(levels: LogLevel[]) {
    winstonLogger.level = levels[0];
  }
}

export default winstonLogger;
