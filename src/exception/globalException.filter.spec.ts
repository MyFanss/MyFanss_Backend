import { GlobalExceptionFilter } from './globalException.filter';
import { HttpException, HttpStatus, BadRequestException, UnauthorizedException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { ArgumentsHost, HttpArgumentsHost } from '@nestjs/common/interfaces';
import { Request, Response } from 'express';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      method: 'GET',
      url: '/api/v1/test',
    };
    const mockHttpContext: Partial<HttpArgumentsHost> = {
      getResponse: <T = any>() => mockResponse as unknown as T,
      getRequest: <T = any>() => mockRequest as unknown as T,
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpContext),
    } as unknown as ArgumentsHost;
  });

  it('1. should handle basic HttpException (400) and set BAD_REQUEST code', () => {
    const exception = new BadRequestException('Bad request message');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Bad request message',
        error: 'Bad Request',
        code: 'BAD_REQUEST',
      }),
    );
  });

  it('2. should handle generic Error and set INTERNAL_SERVER_ERROR code', () => {
    const exception = new Error('Unexpected error');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred | internal server error',
        error: 'Error',
        code: 'INTERNAL_SERVER_ERROR',
      }),
    );
  });

  it('3. should handle unknown exception correctly', () => {
    const exception = { some: 'unknown' };
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred | internal server error',
        error: 'UnknownError',
        code: 'INTERNAL_SERVER_ERROR',
      }),
    );
  });

  it('4. should handle HttpException with custom code and details (Validation Error)', () => {
    const exception = new BadRequestException({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: [{ field: 'email', message: 'must be an email' }],
    });
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: [{ field: 'email', message: 'must be an email' }],
      }),
    );
  });

  it('5. should map 401 to UNAUTHORIZED code', () => {
    const exception = new UnauthorizedException('Not logged in');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.UNAUTHORIZED,
        code: 'UNAUTHORIZED',
      }),
    );
  });

  it('6. should map 403 to FORBIDDEN code', () => {
    const exception = new ForbiddenException('No permission');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'FORBIDDEN',
      }),
    );
  });

  it('7. should map 404 to NOT_FOUND code', () => {
    const exception = new NotFoundException('Resource missing');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        code: 'NOT_FOUND',
      }),
    );
  });

  it('8. should map 409 to CONFLICT code', () => {
    const exception = new ConflictException('Already exists');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        code: 'CONFLICT',
      }),
    );
  });
});
