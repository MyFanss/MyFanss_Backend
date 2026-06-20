import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationsService,
  NotificationEventType,
} from './notifications.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationPreference } from './notification-preference.entity';
import { BadRequestException } from '@nestjs/common';
import { UpdateNotificationPreferencesDto } from './dtos/update-notification-preferences.dto';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockRepository = {
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDefaultPreferences', () => {
    it('should return existing preferences if they exist', async () => {
      const existingPref = { userId: 1, securityAlerts: true };
      mockRepository.findOneBy.mockResolvedValue(existingPref);

      const result = await service.createDefaultPreferences(1);
      expect(result).toEqual(existingPref);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should create and save default preferences if none exist', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);
      const newPref = {
        userId: 1,
        securityAlerts: true,
        newSubscriber: true,
        postFromSubscribedCreator: true,
        marketing: false,
      };
      mockRepository.create.mockReturnValue(newPref);
      mockRepository.save.mockResolvedValue(newPref);

      const result = await service.createDefaultPreferences(1);

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: 1,
        newSubscriber: true,
        postFromSubscribedCreator: true,
        securityAlerts: true,
        marketing: false,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(newPref);
      expect(result).toEqual(newPref);
    });
  });

  describe('getPreferences', () => {
    it('should return preferences and transform to DTO', async () => {
      mockRepository.findOneBy.mockResolvedValue({
        id: 1,
        userId: 1,
        securityAlerts: true,
        marketing: false,
      });

      const result = await service.getPreferences(1);
      expect(result.securityAlerts).toBe(true);
      expect(result.marketing).toBe(false);
    });

    it('should lazy-create preferences if missing', async () => {
      mockRepository.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      const newPref = {
        id: 1,
        userId: 1,
        securityAlerts: true,
        marketing: false,
      };
      mockRepository.create.mockReturnValue(newPref);
      mockRepository.save.mockResolvedValue(newPref);

      const result = await service.getPreferences(1);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.securityAlerts).toBe(true);
    });
  });

  describe('updatePreferences', () => {
    it('should partially update preferences', async () => {
      const existing = { userId: 1, securityAlerts: true, marketing: false };
      mockRepository.findOneBy.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue({ ...existing, marketing: true });

      const result = await service.updatePreferences(1, { marketing: true });
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...existing,
        marketing: true,
      });
      expect(result.marketing).toBe(true);
    });

    it('should throw BadRequestException for invalid keys', async () => {
      const existing = { userId: 1, securityAlerts: true, marketing: false };
      mockRepository.findOneBy.mockResolvedValue(existing);

      await expect(
        service.updatePreferences(1, {
          invalidKey: true,
        } as unknown as UpdateNotificationPreferencesDto),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('shouldNotify', () => {
    it('should return boolean for valid event type', async () => {
      mockRepository.findOneBy.mockResolvedValue({
        userId: 1,
        securityAlerts: true,
      });

      const result = await service.shouldNotify(1, 'securityAlerts');
      expect(result).toBe(true);
    });

    it('should throw BadRequestException for invalid event type', async () => {
      await expect(
        service.shouldNotify(
          1,
          'invalidEvent' as unknown as NotificationEventType,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
