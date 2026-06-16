import { Test, TestingModule } from '@nestjs/testing';
import { PermissionService, JwtPayload } from './permission.service';
import { User } from '../user.entity';

describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionService],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAccessibleOrgIds', () => {
    it('should return empty array for admin (access to all)', () => {
      const adminUser: JwtPayload = {
        id: 1,
        email: 'admin@example.com',
        role: 'admin',
      };
      const result = service.getAccessibleOrgIds(adminUser);
      expect(result).toEqual([]);
    });

    it('should return org id for manager', () => {
      const managerUser: JwtPayload = {
        id: 2,
        email: 'manager@example.com',
        role: 'manager',
        orgId: 5,
      };
      const result = service.getAccessibleOrgIds(managerUser);
      expect(result).toEqual([5]);
    });

    it('should return empty array for regular user', () => {
      const regularUser: JwtPayload = {
        id: 3,
        email: 'user@example.com',
        role: 'user',
      };
      const result = service.getAccessibleOrgIds(regularUser);
      expect(result).toEqual([]);
    });
  });

  describe('canViewUserDetails', () => {
    it('admin should view all users', () => {
      const admin: JwtPayload = {
        id: 1,
        email: 'admin@example.com',
        role: 'admin',
      };
      expect(service.canViewUserDetails(2, admin)).toBe(true);
    });

    it('user should view their own details', () => {
      const user: JwtPayload = {
        id: 5,
        email: 'user@example.com',
        role: 'user',
      };
      expect(service.canViewUserDetails(5, user)).toBe(true);
    });

    it('user should not view others details', () => {
      const user: JwtPayload = {
        id: 5,
        email: 'user@example.com',
        role: 'user',
      };
      expect(service.canViewUserDetails(10, user)).toBe(false);
    });

    it('manager should view users in their org', () => {
      const manager: JwtPayload = {
        id: 2,
        email: 'manager@example.com',
        role: 'manager',
        orgId: 3,
      };
      expect(service.canViewUserDetails(4, manager)).toBe(true);
    });
  });

  describe('filterByPermission', () => {
    const mockUsers: User[] = [
      {
        id: 1,
        name: 'Admin',
        email: 'admin@example.com',
        password: 'hashed',
        role: 'admin',
        status: 'active',
        org_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        is_deleted: false,
        search_text: '',
      },
      {
        id: 2,
        name: 'Manager',
        email: 'manager@example.com',
        password: 'hashed',
        role: 'manager',
        status: 'active',
        org_id: 2,
        created_at: new Date(),
        updated_at: new Date(),
        is_deleted: false,
        search_text: '',
      },
      {
        id: 3,
        name: 'User',
        email: 'user@example.com',
        password: 'hashed',
        role: 'user',
        status: 'active',
        org_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        is_deleted: false,
        search_text: '',
      },
    ];

    it('admin should see all users', () => {
      const admin: JwtPayload = {
        id: 1,
        email: 'admin@example.com',
        role: 'admin',
      };
      const result = service.filterByPermission(mockUsers, admin);
      expect(result).toHaveLength(3);
    });

    it('manager should see users in their org and unassigned', () => {
      const manager: JwtPayload = {
        id: 2,
        email: 'manager@example.com',
        role: 'manager',
        orgId: 2,
      };
      const result = service.filterByPermission(mockUsers, manager);
      expect(result).toHaveLength(2); // Manager's org + unassigned user
    });

    it('user should see only themselves', () => {
      const user: JwtPayload = {
        id: 3,
        email: 'user@example.com',
        role: 'user',
      };
      const result = service.filterByPermission(mockUsers, user);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });
  });

  describe('getSortableFieldsForRole', () => {
    it('admin should have access to all sortable fields', () => {
      const result = service.getSortableFieldsForRole('admin');
      expect(result).toContain('created_at');
      expect(result).toContain('role');
      expect(result).toContain('org_id');
    });

    it('manager should have limited sortable fields', () => {
      const result = service.getSortableFieldsForRole('manager');
      expect(result).toContain('created_at');
      expect(result).not.toContain('role');
    });

    it('user should have basic sortable fields', () => {
      const result = service.getSortableFieldsForRole('user');
      expect(result).toContain('created_at');
      expect(result).not.toContain('role');
      expect(result).not.toContain('status');
    });
  });

  describe('getFilterableFieldsForRole', () => {
    it('admin should have access to all filterable fields', () => {
      const result = service.getFilterableFieldsForRole('admin');
      expect(result).toContain('role');
      expect(result).toContain('org_id');
    });

    it('manager should have limited filterable fields', () => {
      const result = service.getFilterableFieldsForRole('manager');
      expect(result).toContain('status');
      expect(result).not.toContain('role');
    });

    it('user should have no filterable fields', () => {
      const result = service.getFilterableFieldsForRole('user');
      expect(result).toHaveLength(0);
    });
  });
});
