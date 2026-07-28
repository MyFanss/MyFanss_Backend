import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GdprService } from './gdpr.service';
import { User } from '../user.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { NotificationPreference } from '../../notifications/notification-preference.entity';
import { Subscription } from '../../subscriptions/subscription.entity';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/audit-action.enum';
import { AppLogger } from '../../logger/app-logger.service';
import { NotFoundException } from '@nestjs/common';

describe('GdprService', () => {
  let service: GdprService;
  let userRepo: jest.Mocked<Repository<User>>;
  let tokenRepo: jest.Mocked<Repository<RefreshToken>>;
  let prefRepo: jest.Mocked<Repository<NotificationPreference>>;
  let subRepo: jest.Mocked<Repository<Subscription>>;
  let auditService: jest.Mocked<AuditService>;
  let logger: jest.Mocked<AppLogger>;

  const mockUser: User = {
    id: 1,
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: '$2b$10$somehash',
    role: 'fan',
    status: 'active',
    org_id: null,
    created_at: new Date('2024-01-15T10:30:00.000Z'),
    updated_at: new Date('2024-06-01T08:00:00.000Z'),
    is_deleted: false,
    search_text: "",
    displayName: 'JaneDoe',
    bio: 'Content creator',
    avatarUrl: 'https://cdn.example.com/avatars/jane.jpg',
  };

  const mockPreferences: NotificationPreference = {
    id: 1,
    userId: 1,
    user: null as any,
    newSubscriber: true,
    postFromSubscribedCreator: true,
    securityAlerts: true,
    marketing: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSubscription: Subscription = {
    id: 'uuid-1',
    fanId: 1,
    fan: null as any,
    creatorId: 2,
    creator: null as any,
    status: 'active',
    subscribedAt: new Date('2024-02-01'),
    cancelledAt: null,
  };

  beforeEach(async () => {
    userRepo = { findOneBy: jest.fn(), save: jest.fn() } as any;
    tokenRepo = { update: jest.fn() } as any;
    prefRepo = { findOneBy: jest.fn() } as any;
    subRepo = { find: jest.fn() } as any;
    auditService = { log: jest.fn() } as any;
    logger = { log: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: tokenRepo },
        { provide: getRepositoryToken(NotificationPreference), useValue: prefRepo },
        { provide: getRepositoryToken(Subscription), useValue: subRepo },
        { provide: AuditService, useValue: auditService },
        { provide: AppLogger, useValue: logger },
      ],
    }).compile();

    service = module.get<GdprService>(GdprService);
  });

  describe('exportUserData', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      userRepo.findOneBy.mockResolvedValue(null);
      await expect(service.exportUserData(999)).rejects.toThrow(NotFoundException);
    });

    it('should return user profile without password hash', async () => {
      userRepo.findOneBy.mockResolvedValue(mockUser);
      prefRepo.findOneBy.mockResolvedValue(mockPreferences);
      subRepo.find.mockResolvedValue([mockSubscription]);
      const result = await service.exportUserData(1);
      expect(result.profile).toBeDefined();
      expect(result.profile.id).toBe(1);
      expect(result.profile.name).toBe('Jane Doe');
      expect(result.profile.email).toBe('jane@example.com');
      expect((result.profile as any).password).toBeUndefined();
    });

    it('should include notification preferences when they exist', async () => {
      userRepo.findOneBy.mockResolvedValue(mockUser);
      prefRepo.findOneBy.mockResolvedValue(mockPreferences);
      subRepo.find.mockResolvedValue([]);
      const result = await service.exportUserData(1);
      expect(result.notificationPreferences).toBeDefined();
      expect(result.notificationPreferences!.newSubscriber).toBe(true);
      expect(result.notificationPreferences!.marketing).toBe(false);
    });

    it('should set notificationPreferences to null when none exist', async () => {
      userRepo.findOneBy.mockResolvedValue(mockUser);
      prefRepo.findOneBy.mockResolvedValue(null);
      subRepo.find.mockResolvedValue([]);
      const result = await service.exportUserData(1);
      expect(result.notificationPreferences).toBeNull();
    });

    it('should include subscriptions', async () => {
      userRepo.findOneBy.mockResolvedValue(mockUser);
      prefRepo.findOneBy.mockResolvedValue(null);
      subRepo.find.mockResolvedValue([mockSubscription]);
      const result = await service.exportUserData(1);
      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0].fanId).toBe(1);
      expect(result.subscriptions[0].creatorId).toBe(2);
    });

    it('should audit the export action', async () => {
      userRepo.findOneBy.mockResolvedValue(mockUser);
      prefRepo.findOneBy.mockResolvedValue(null);
      subRepo.find.mockResolvedValue([]);
      await service.exportUserData(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 1, action: AuditAction.GDPR_DATA_EXPORTED, targetType: 'User', targetId: 1 }),
      );
    });

    it('should include an exportedAt timestamp', async () => {
      userRepo.findOneBy.mockResolvedValue(mockUser);
      prefRepo.findOneBy.mockResolvedValue(null);
      subRepo.find.mockResolvedValue([]);
      const result = await service.exportUserData(1);
      expect(result.exportedAt).toBeDefined();
      expect(result.exportedAt instanceof Date).toBe(true);
    });
  });

  describe('selfDeleteUser', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      userRepo.findOneBy.mockResolvedValue(null);
      await expect(service.selfDeleteUser(999)).rejects.toThrow(NotFoundException);
    });

    it('should soft-delete the user', async () => {
      userRepo.findOneBy.mockResolvedValue(mockUser);
      userRepo.save.mockResolvedValue({ ...mockUser, is_deleted: true, status: 'inactive' });
      await service.selfDeleteUser(1);
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_deleted: true, status: 'inactive' }),
      );
    });

    it('should revoke all active refresh tokens', async () => {
      userRepo.findOneBy.mockResolvedValue(mockUser);
      userRepo.save.mockResolvedValue(mockUser);
      await service.selfDeleteUser(1);
      expect(tokenRepo.update).toHaveBeenCalledWith(
        { userId: 1, isRevoked: false }, { isRevoked: true },
      );
    });

    it('should audit the self-delete action', async () => {
      userRepo.findOneBy.mockResolvedValue(mockUser);
      userRepo.save.mockResolvedValue(mockUser);
      await service.selfDeleteUser(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 1, action: AuditAction.USER_SELF_DELETED, targetType: 'User', targetId: 1 }),
      );
    });
  });
});
