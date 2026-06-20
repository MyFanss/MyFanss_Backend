import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/role.enum';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.FAN]: 0,
  [UserRole.CREATOR]: 1,
  [UserRole.ADMIN]: 2,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
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

    for (const requiredRole of requiredRoles) {
      if (userRole === requiredRole) {
        return true;
      }
    }

    throw new ForbiddenException({
      message: 'Access denied',
      code: 'INSUFFICIENT_ROLE',
    });
  }
}

export const hasMinRole = (userRole: UserRole, minRole: UserRole): boolean => {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
};
