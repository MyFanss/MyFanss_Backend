import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return asyncLocalStorage.run(context, callback);
}

export function getRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId;
}
