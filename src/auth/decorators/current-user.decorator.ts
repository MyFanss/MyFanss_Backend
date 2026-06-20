import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedRequestUser {
  userId: number;
  email: string;
  username: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (!data || !request.user) {
      return request.user;
    }
    return (request.user as Record<string, unknown>)[data];
  },
);
