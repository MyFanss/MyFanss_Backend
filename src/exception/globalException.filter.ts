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
  // private readonly logger = new Logger(GlobalExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost): void {
    const caughtException = host.switchToHttp();

    // response and request objects
    // instance of the response to send out the error
    const response = caughtException.getResponse<Response>();

    // instance of the request to get the request details
    const request = caughtException.getRequest<Request>();

    // get the appropriate status code of the the exception thrown e.g 400, 404 
    // or 500 if it internal error
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    // get the message thrown from the exception object
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

    
    // this.logger.error(
    //   `[${request.method}] ${request.url} ${status} - ${errorMessage}`,
    //   exception instanceof Error ? exception.stack : '',
    // );



    // a json response to send out showing the full error details
    response.status(status).json({
      statusCode: status,
      message: message,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: error,
    });
  }
}
