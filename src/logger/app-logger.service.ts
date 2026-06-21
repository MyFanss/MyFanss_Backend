import {
  Injectable,
  LoggerService as NestLoggerService,
  LogLevel,
} from '@nestjs/common';
import {
  createLogger,
  format,
  transports,
  Logger as WinstonLogger,
} from 'winston';
import { getRequestId } from '../common/request-context/request-context.storage';

const isProduction = process.env.NODE_ENV === 'production';

const winstonLogger: WinstonLogger = createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction
    ? format.json()
    : format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf((info) => {
          const { timestamp, level, message, context, requestId, ...meta } =
            info;
          const requestIdPart =
            typeof requestId === 'string' ? ` [${requestId}]` : '';
          const contextPart =
            typeof context === 'string' ? ` [${context}]` : '';
          const metaSuffix =
            Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
          return `${String(timestamp)} [${String(level)}]${contextPart}${requestIdPart}: ${String(message)}${metaSuffix}`;
        }),
      ),
  transports: [new transports.Console()],
});

function buildMeta(
  context?: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const requestId = getRequestId();
  return {
    ...(context ? { context } : {}),
    ...(requestId ? { requestId } : {}),
    ...extra,
  };
}

@Injectable()
export class AppLogger implements NestLoggerService {
  log(message: any, context?: string) {
    winstonLogger.info(message, buildMeta(context));
  }
  error(message: any, trace?: string, context?: string) {
    winstonLogger.error(message, buildMeta(context, { trace }));
  }
  warn(message: any, context?: string) {
    winstonLogger.warn(message, buildMeta(context));
  }
  debug?(message: any, context?: string) {
    winstonLogger.debug(message, buildMeta(context));
  }
  verbose?(message: any, context?: string) {
    winstonLogger.verbose(message, buildMeta(context));
  }
  setLogLevels?(levels: LogLevel[]) {
    winstonLogger.level = levels[0];
  }
}

export default winstonLogger;
