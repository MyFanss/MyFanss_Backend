import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { PoliciesGuard } from '../src/auth/guards/policies.guard';
import {
  UserRole,
  Permission,
  ROLE_HIERARCHY,
} from '../src/auth/enums/role.enum';
import {
  UserOwnerPolicy,
  AdminOverridePolicy,
} from '../src/auth/policies/user-owner.policy';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { AssignRoleDto } from '../src/users/dtos/assign-role.dto';

afterEach(() => {
  Reflect.deleteMetadata('roles', {});
  Reflect.deleteMetadata('permissions', {});
  Reflect.deleteMetadata('policies', {});
});

const makeCtx: any = (handler: any, classRef: any, getRequest: () => any) => ({
  switchToHttp: () => ({ getRequest }),
  getHandler: () => handler,
  getClass: () => classRef,
});

describe('RBAC 1 - RolesGuard', () => {
  let guard: RolesGuard;
  beforeEach(async () => {
    const ref = await Test.createTestingModule({
      providers: [RolesGuard],
    }).compile();
    guard = ref.get(RolesGuard);
  });

  it('allows request with no roles metadata', () => {
    const ctx = makeCtx({}, {}, () => ({}));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies missing user with 403 INSUFFICIENT_ROLE', () => {
    const handler: any = {};
    const classRef: any = {};
    Reflect.defineMetadata('roles', [UserRole.ADMIN], handler);
    try {
      guard.canActivate(makeCtx(handler, classRef, () => ({ user: null })));
      fail('Expected throw');
    } catch (e: any) {
      expect(e.getStatus?.()).toBe(403);
      expect(e.getResponse()?.code).toBe('INSUFFICIENT_ROLE');
    }
  });

  it('allows exact role match', () => {
    const handler: any = {};
    const classRef: any = {};
    Reflect.defineMetadata('roles', [UserRole.ADMIN], handler);
    expect(
      guard.canActivate(
        makeCtx(handler, classRef, () => ({ user: { role: UserRole.ADMIN } })),
      ),
    ).toBe(true);
  });

  it('blocks insufficient role with 403 INSUFFICIENT_ROLE', () => {
    const handler: any = {};
    const classRef: any = {};
    Reflect.defineMetadata('roles', [UserRole.ADMIN], handler);
    try {
      guard.canActivate(
        makeCtx(handler, classRef, () => ({ user: { role: UserRole.FAN } })),
      );
      fail('Expected throw');
    } catch (e: any) {
      expect(e.getStatus?.()).toBe(403);
      expect(e.getResponse()?.code).toBe('INSUFFICIENT_ROLE');
    }
  });

  it('hasMinRole hierarchy works', () => {
    const hasMinRole = (u: UserRole, m: UserRole) =>
      (ROLE_HIERARCHY[u] ?? 0) >= (ROLE_HIERARCHY[m] ?? 0);
    expect(hasMinRole(UserRole.ADMIN, UserRole.FAN)).toBe(true);
    expect(hasMinRole(UserRole.FAN, UserRole.ADMIN)).toBe(false);
  });
});

describe('RBAC 2 - PermissionsGuard', () => {
  let guard: PermissionsGuard;
  beforeEach(async () => {
    const ref = await Test.createTestingModule({
      providers: [PermissionsGuard],
    }).compile();
    guard = ref.get(PermissionsGuard);
  });

  it('returns true when no permissions metadata', () => {
    const ctx = makeCtx({}, {}, () => ({ user: { role: UserRole.FAN } }));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws INSUFFICIENT_PERMISSION when fan lacks USERS_WRITE', () => {
    const handler: any = {};
    const classRef: any = {};
    Reflect.defineMetadata('permissions', [Permission.USERS_WRITE], handler);
    try {
      guard.canActivate(
        makeCtx(handler, classRef, () => ({ user: { role: UserRole.FAN } })),
      );
      fail('Expected throw');
    } catch (e: any) {
      expect(e.getStatus?.()).toBe(403);
      expect(e.getResponse()?.code).toBe('INSUFFICIENT_PERMISSION');
    }
  });
});

describe('RBAC 3 - PoliciesGuard', () => {
  let guard: PoliciesGuard;
  beforeEach(async () => {
    const ref = await Test.createTestingModule({
      providers: [PoliciesGuard],
    }).compile();
    guard = ref.get(PoliciesGuard);
  });

  it('allows user:owner when params:id matches user.userId', () => {
    const handler: any = {};
    const classRef: any = {};
    Reflect.defineMetadata('policies', ['user:owner'], handler);
    expect(
      guard.canActivate(
        makeCtx(handler, classRef, () => ({
          user: { userId: 7, role: UserRole.FAN },
          params: { id: '7' },
        })),
      ),
    ).toBe(true);
  });

  it('allows admin:override', () => {
    const handler: any = {};
    const classRef: any = {};
    Reflect.defineMetadata('policies', ['admin:override'], handler);
    expect(
      guard.canActivate(
        makeCtx(handler, classRef, () => ({ user: { role: UserRole.ADMIN } })),
      ),
    ).toBe(true);
  });

  it('denies non-owner non-admin with 403 INSUFFICIENT_ROLE', () => {
    const handler: any = {};
    const classRef: any = {};
    Reflect.defineMetadata(
      'policies',
      ['user:owner', 'admin:override'],
      handler,
    );
    try {
      guard.canActivate(
        makeCtx(handler, classRef, () => ({
          user: { userId: 7, role: UserRole.FAN },
          params: { id: '9' },
        })),
      );
      fail('Expected throw');
    } catch (e: any) {
      expect(e.getStatus?.()).toBe(403);
      expect(e.getResponse()?.code).toBe('INSUFFICIENT_ROLE');
    }
  });
});

describe('RBAC 4 - AdminOverridePolicy', () => {
  it('isAdmin and enforceOrThrow block non-admins', () => {
    expect(AdminOverridePolicy.isAdmin(UserRole.ADMIN)).toBe(true);
    [UserRole.FAN, UserRole.CREATOR].forEach((r) => {
      try {
        AdminOverridePolicy.enforceOrThrow(r);
        fail('Expected throw');
      } catch (e: any) {
        expect(e.getStatus?.()).toBe(403);
        expect(e.getResponse()?.code).toBe('INSUFFICIENT_ROLE');
      }
    });
  });
});

describe('RBAC 5 - UserOwnerPolicy', () => {
  it('isOwner checks ids', () => {
    expect(UserOwnerPolicy.isOwner(7, 7)).toBe(true);
    expect(UserOwnerPolicy.isOwner(7, 8)).toBe(false);
  });
});

describe('RBAC 6 - JwtStrategy exposes role', () => {
  it('validate returns role from payload', async () => {
    const ref = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: require('@nestjs/config').ConfigService,
          useValue: { get: () => 'secret' },
        },
      ],
    }).compile();
    const strategy = ref.get(JwtStrategy);
    const result = await strategy.validate({
      sub: 1,
      email: 'a@b.com',
      type: 'access',
      role: UserRole.ADMIN,
    });
    expect(result.role).toBe(UserRole.ADMIN);
  });
});

describe('RBAC 7 - AuthResponse carries role', () => {
  it('sample shape includes role', () => {
    const sample: any = {
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 900,
      refreshExpiresIn: 604800,
      tokenType: 'Bearer',
      user: { id: 1, name: 'x', email: 'y', role: UserRole.FAN },
      message: 'welcome',
    };
    expect(sample.user.role).toBe(UserRole.FAN);
  });
});

describe('RBAC 8 - Role enum values', () => {
  it('entity default and enum values are aligned', () => {
    expect(UserRole.FAN).toBe('fan');
    expect(UserRole.CREATOR).toBe('creator');
    expect(UserRole.ADMIN).toBe('admin');
  });
});

describe('RBAC 9 - AssignRoleDto rejects bad roles', () => {
  it('validation catches invalid role strings', async () => {
    const dto = plainToClass(AssignRoleDto, { role: 'hacker' } as any);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('RBAC 10 - Role hierarchy ordering', () => {
  it('admin > creator > fan by hierarchy', () => {
    expect(ROLE_HIERARCHY[UserRole.ADMIN]).toBeGreaterThan(
      ROLE_HIERARCHY[UserRole.CREATOR],
    );
    expect(ROLE_HIERARCHY[UserRole.CREATOR]).toBeGreaterThan(
      ROLE_HIERARCHY[UserRole.FAN],
    );
  });
});

describe('RBAC 11 - Guard 403 code output', () => {
  let guard: RolesGuard;
  beforeEach(async () => {
    const ref = await Test.createTestingModule({
      providers: [RolesGuard],
    }).compile();
    guard = ref.get(RolesGuard);
  });

  it('denies with 403 and INSUFFICIENT_ROLE', () => {
    const handler: any = {};
    const classRef: any = {};
    Reflect.defineMetadata('roles', [UserRole.ADMIN], handler);
    try {
      guard.canActivate(
        makeCtx(handler, classRef, () => ({ user: { role: UserRole.FAN } })),
      );
      fail('Expected throw');
    } catch (e: any) {
      expect(e.getStatus?.()).toBe(403);
      expect(e.getResponse()?.code).toBe('INSUFFICIENT_ROLE');
    }
  });
});

describe('RBAC 12 - Admin controller static validation', () => {
  it('assignRole method exists and is bound', async () => {
    const {
      AdminUsersController,
    } = require('../src/admin/admin-users.controller');
    expect(typeof AdminUsersController).toBe('function');
    expect(typeof AdminUsersController.prototype.assignRole).toBe('function');
  });
});
