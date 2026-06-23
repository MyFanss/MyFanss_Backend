import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data is undefined or null, return empty data
        if (data === undefined || data === null) {
          return { data: null } as any;
        }

        // If the response is already in the { data, meta } format, return it
        if (
          typeof data === 'object' &&
          'data' in data &&
          !Array.isArray(data)
        ) {
          // It could be a paginated response with data and pagination properties
          const { data: innerData, pagination, meta, ...rest } = data;
          return {
            data: innerData,
            meta: meta || pagination || (Object.keys(rest).length ? rest : undefined),
          };
        }

        return { data };
      }),
    );
  }
}
