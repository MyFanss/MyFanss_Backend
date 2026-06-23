import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '../logger/app-logger.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new AppLogger();

  catch(exception: unknown, host: ArgumentsHost): void {
    const caughtException = host.switchToHttp();
    const response = caughtException.getResponse<Response>();
    const request = caughtException.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    let message: string | string[] =
      'An error occurred | internal server error';
    let error =
      exception instanceof HttpException
        ? exception.name
        : ((exception as Error)?.name ?? 'UnknownError');
    let code: string | undefined;

    let details: any[] | undefined;

    if (exception instanceof HttpException) {
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'object' && exResponse !== null) {
        const responseBody = exResponse as Record<string, unknown>;
        message =
          (responseBody.message as string | string[] | undefined) ??
          exception.message;
        error = (responseBody.error as string | undefined) ?? error;
        code = responseBody.code as string | undefined;
        details = responseBody.details as any[] | undefined;
      } else if (typeof exResponse === 'string') {
        message = exResponse;
      } else {
        message = exception.message;
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
      exception instanceof Error ? exception.stack : '',
      GlobalExceptionFilter.name,
    );

    const body: Record<string, unknown> = {
      statusCode: status,
      error,
      message: errorMessage,
      code,
    };
    if (details) body.details = details;

    response.status(status).json(body);
  }
}
