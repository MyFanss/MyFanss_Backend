import { Request, Response } from 'express';
import { RequestIdMiddleware } from './request-id.middleware';
import { getRequestId } from '../request-context/request-context.storage';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    mockRequest = { headers: {} };
    mockResponse = {
      setHeader: jest.fn(),
    };
    next = jest.fn();
  });

  it('generates a request ID when the client does not send one', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, next);

    const requestId = mockRequest.headers?.['x-request-id'] as string;
    expect(requestId).toBeDefined();
    expect(requestId).toHaveLength(36);
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      requestId,
    );
    expect(next).toHaveBeenCalled();
  });

  it('respects a client-provided X-Request-Id header', () => {
    mockRequest.headers = { 'x-request-id': 'client-provided-id' };

    middleware.use(mockRequest as Request, mockResponse as Response, next);

    expect(mockRequest.headers['x-request-id']).toBe('client-provided-id');
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      'client-provided-id',
    );
  });

  it('stores the request ID in async context for downstream handlers', (done) => {
    next.mockImplementation(() => {
      expect(getRequestId()).toBe(mockRequest.headers?.['x-request-id']);
      done();
    });

    middleware.use(mockRequest as Request, mockResponse as Response, next);
  });
});
