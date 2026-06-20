import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '../logger/app-logger.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ThrottlerException: new (...args: any[]) => HttpException =
  (() => {
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
    if (
      ThrottlerException &&
      exception instanceof ThrottlerException
    ) {
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
      } else if (typeof exResponse === 'string') {
        message = exResponse;
      } else {
        message = normalized.message;
      }
    }

    const errorMessage =
      typeof message === 'string' ? message : message.join(', ');

    this.logger.error(
      `[${request.method}] ${request.url} ${status} - ${errorMessage}`,
      normalized instanceof Error ? normalized.stack : '',
      GlobalExceptionFilter.name,
    );

    const body: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      error,
    };
    if (code) body.code = code;

    response.status(status).json(body);
  }
}
