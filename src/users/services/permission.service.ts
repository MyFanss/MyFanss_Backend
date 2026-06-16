import { Injectable } from '@nestjs/common';
import { User } from '../user.entity';

export interface JwtPayload {
  id: number;
  email: string;
  role: string;
  orgId?: number;
}

@Injectable()
export class PermissionService {
  getAccessibleOrgIds(user: JwtPayload): number[] {
    // Admins have access to all orgs (represented by empty array)
    if (user.role === 'admin') {
      return [];
    }

    // Managers see their own org + users without org
    if (user.role === 'manager' && user.orgId) {
      return [user.orgId];
    }

    // Regular users see only their own record
    return [];
  }

  canViewUserDetails(userId: number, requestingUser: JwtPayload): boolean {
    // Admins can view all
    if (requestingUser.role === 'admin') {
      return true;
    }

    // Users can view their own details
    if (userId === requestingUser.id) {
      return true;
    }

    // Managers can view users in their org
    if (requestingUser.role === 'manager' && requestingUser.orgId) {
      return true;
    }

    return false;
  }

  filterByPermission(users: User[], requestingUser: JwtPayload): User[] {
    if (requestingUser.role === 'admin') {
      return users;
    }

    if (requestingUser.role === 'manager' && requestingUser.orgId) {
      // Managers see users in their org + users without org assignment
      return users.filter(
        (u) => u.org_id === requestingUser.orgId || u.org_id === null,
      );
    }

    // Regular users see only themselves
    return users.filter((u) => u.id === requestingUser.id);
  }

  getSortableFieldsForRole(role: string): string[] {
    const baseSortable = ['created_at', 'name', 'email'];

    if (role === 'admin') {
      return [...baseSortable, 'role', 'status', 'org_id'];
    }

    if (role === 'manager') {
      return [...baseSortable, 'status'];
    }

    return baseSortable;
  }

  getFilterableFieldsForRole(role: string): string[] {
    const baseFilterable = ['status'];

    if (role === 'admin') {
      return [...baseFilterable, 'role', 'org_id', 'created_at'];
    }

    if (role === 'manager') {
      return [...baseFilterable, 'created_at'];
    }

    return [];
  }
}
