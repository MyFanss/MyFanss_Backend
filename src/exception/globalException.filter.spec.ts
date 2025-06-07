

import { GlobalExceptionFilter } from './globalException.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost, HttpArgumentsHost } from '@nestjs/common/interfaces';
import { Request, Response } from 'express';
import { Test } from '@nestjs/testing';

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
      url: '/api/test',
    };
    const mockHttpContext: Partial<HttpArgumentsHost> = {
      getResponse: <T = any>() => mockResponse as unknown as T,
      getRequest: <T = any>() => mockRequest as unknown as T,
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpContext),
    } as unknown as ArgumentsHost;
  });

  it('should handle HttpException correctly', () => {
    const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Bad request',
        error: 'HttpException',
        path: '/api/test',
        timestamp: expect.any(String),
      }),
    );
    expect(mockResponse.json).toHaveBeenCalledTimes(1);
  });

  it('should handle generic Error correctly', () => {
    const exception = new Error('Unexpected error');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred | internal server error',
        error: 'Error',
        path: '/api/test',
        timestamp: expect.any(String),
      }),
    );
    expect(mockResponse.json).toHaveBeenCalledTimes(1);
  });

  it('should handle unknown exception correctly', () => {
    const exception = { some: 'unknown' };
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred | internal server error',
        error: 'UnknownError',
        path: '/api/test',
        timestamp: expect.any(String),
      }),
    );
    expect(mockResponse.json).toHaveBeenCalledTimes(1);
  });
});