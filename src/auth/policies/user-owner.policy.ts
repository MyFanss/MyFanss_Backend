import { Injectable, ForbiddenException } from '@nestjs/common';
import { UserRole, ROLE_HIERARCHY } from '../enums/role.enum';

@Injectable()
export class UserOwnerPolicy {
  static isOwner(userId: number, targetUserId: number): boolean {
    return userId === targetUserId;
  }

  static hasPrivilege(userRole: string, minRole: UserRole): boolean {
    const roleLevel = ROLE_HIERARCHY[userRole as UserRole] ?? 0;
    const minLevel = ROLE_HIERARCHY[minRole] ?? 0;
    return roleLevel >= minLevel;
  }

  static enforceOrThrow(userRole: string, minRole: UserRole): void {
    if (!this.hasPrivilege(userRole, minRole)) {
      throw new ForbiddenException({
        message: 'Access denied',
        code: 'INSUFFICIENT_ROLE',
      });
    }
  }
}

@Injectable()
export class AdminOverridePolicy {
  static isAdmin(role: string): boolean {
    return role === UserRole.ADMIN;
  }

  static enforceOrThrow(role: string): void {
    if (!this.isAdmin(role)) {
      throw new ForbiddenException({
        message: 'Access denied',
        code: 'INSUFFICIENT_ROLE',
      });
    }
  }
}
