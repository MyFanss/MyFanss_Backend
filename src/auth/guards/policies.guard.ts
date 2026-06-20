import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, ROLE_HIERARCHY } from '../enums/role.enum';

@Injectable()
export class PoliciesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const policies = this.reflector.getAllAndOverride<string[]>('policies', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!policies || policies.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException({
        message: 'Access denied',
        code: 'INSUFFICIENT_ROLE',
      });
    }

    const userRole = user.role as UserRole;
    const isAllowed = policies.some((policy) =>
      this.evaluatePolicy(policy, user, request),
    );

    if (!isAllowed) {
      throw new ForbiddenException({
        message: 'Access denied',
        code: 'INSUFFICIENT_ROLE',
      });
    }

    return true;
  }

  private evaluatePolicy(policy: string, user: any, request: any): boolean {
    if (policy === 'user:owner') {
      const targetUserId = request.params?.id
        ? Number(request.params.id)
        : undefined;
      return targetUserId !== undefined && user.userId === targetUserId;
    }

    if (policy === 'admin:override') {
      const userRole = user.role as UserRole;
      return userRole === UserRole.ADMIN;
    }

    return false;
  }
}
