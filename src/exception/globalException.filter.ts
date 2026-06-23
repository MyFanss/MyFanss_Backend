import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../common/middleware/request-id.middleware';
import { getRequestId } from '../common/request-context/request-context.storage';
import { AppLogger } from '../logger/app-logger.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ThrottlerException: new (...args: any[]) => HttpException = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@nestjs/throttler');
    return mod.ThrottlerException;
  } catch {
    return null;
  }
})();

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new AppLogger();

  catch(exception: unknown, host: ArgumentsHost): void {
    const caughtException = host.switchToHttp();
    const response = caughtException.getResponse<Response>();
    const request = caughtException.getRequest<Request>();

    // Normalise ThrottlerException (429) to HttpException for consistent handling
    let normalized = exception;
    if (ThrottlerException && exception instanceof ThrottlerException) {
      normalized = new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later',
          error: 'ThrottlerException',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const status =
      normalized instanceof HttpException ? normalized.getStatus() : 500;

    let message: string | string[] =
      'An error occurred | internal server error';
    let error =
      normalized instanceof HttpException
        ? normalized.name
        : ((normalized as Error)?.name ?? 'UnknownError');
    let code: string | undefined;

    if (normalized instanceof HttpException) {
      const exResponse = normalized.getResponse();
      if (typeof exResponse === 'object' && exResponse !== null) {
        const responseBody = exResponse as Record<string, unknown>;
        message =
          (responseBody.message as string | string[] | undefined) ??
          normalized.message;
        error = (responseBody.error as string | undefined) ?? error;
        code = responseBody.code as string | undefined;
        details = responseBody.details as any[] | undefined;
      } else if (typeof exResponse === 'string') {
        message = exResponse;
      } else {
        message = normalized.message;
      }
    }

    if (!code) {
      switch (status) {
        case 400:
          code = 'BAD_REQUEST';
          break;
        case 401:
          code = 'UNAUTHORIZED';
          break;
        case 403:
          code = 'FORBIDDEN';
          break;
        case 404:
          code = 'NOT_FOUND';
          break;
        case 409:
          code = 'CONFLICT';
          break;
        case 500:
          code = 'INTERNAL_SERVER_ERROR';
          break;
        default:
          code = 'UNKNOWN_ERROR';
          break;
      }
    }

    const errorMessage =
      typeof message === 'string' ? message : message.join(', ');

    this.logger.error(
      `[${request.method}] ${request.url} ${status} - ${errorMessage}`,
      normalized instanceof Error ? normalized.stack : '',
      GlobalExceptionFilter.name,
    );

    const requestId =
      getRequestId() ??
      (typeof request.headers[REQUEST_ID_HEADER] === 'string'
        ? request.headers[REQUEST_ID_HEADER]
        : undefined);

    if (requestId) {
      response.setHeader('X-Request-Id', requestId);
    }

    const body: Record<string, unknown> = {
      statusCode: status,
      error,
      message: errorMessage,
      code,
    };
    if (code) body.code = code;
    if (requestId) body.requestId = requestId;

    response.status(status).json(body);
  }
}
