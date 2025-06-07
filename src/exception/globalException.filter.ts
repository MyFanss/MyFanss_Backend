import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost): void {
    const caughtException = host.switchToHttp();
    const response = caughtException.getResponse<Response>();
    const request = caughtException.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const message =
      exception instanceof HttpException
        ? exception.message
        : 'An error occurred | internal server error';

    const error =
      exception instanceof HttpException
        ? exception.name
        : (exception as Error)?.name ?? 'UnknownError';

    const errorMessage =
      typeof message === 'string'
        ? message
        : (message as any)?.message || 'Unexpected error';

    
    this.logger.error(
      `[${request.method}] ${request.url} ${status} - ${errorMessage}`,
      exception instanceof Error ? exception.stack : '',
    );


    response.status(status).json({
      statusCode: status,
      message: message,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: error,
    });
  }
}
