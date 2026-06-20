export enum UserRole {
  FAN = 'fan',
  CREATOR = 'creator',
  ADMIN = 'admin',
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.FAN]: 0,
  [UserRole.CREATOR]: 1,
  [UserRole.ADMIN]: 2,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.FAN]: 'Fan',
  [UserRole.CREATOR]: 'Creator',
  [UserRole.ADMIN]: 'Admin',
};

export enum Permission {
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_DELETE = 'users:delete',
  USERS_ROLE_ASSIGN = 'users:role:assign',
  CONTENT_READ = 'content:read',
  CONTENT_WRITE = 'content:write',
  PAYOUTS_READ = 'payouts:read',
  SUBSCRIPTIONS_READ = 'subscriptions:read',
  SUBSCRIPTIONS_WRITE = 'subscriptions:write',
}

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.FAN]: [Permission.CONTENT_READ, Permission.SUBSCRIPTIONS_READ],
  [UserRole.CREATOR]: [
    Permission.CONTENT_READ,
    Permission.CONTENT_WRITE,
    Permission.SUBSCRIPTIONS_READ,
  ],
  [UserRole.ADMIN]: [
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.USERS_DELETE,
    Permission.USERS_ROLE_ASSIGN,
    Permission.CONTENT_READ,
    Permission.CONTENT_WRITE,
    Permission.PAYOUTS_READ,
    Permission.SUBSCRIPTIONS_READ,
    Permission.SUBSCRIPTIONS_WRITE,
  ],
};
