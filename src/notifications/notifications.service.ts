import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from './notification-preference.entity';
import { NotificationPreferencesDto } from './dtos/notification-preferences.dto';
import { UpdateNotificationPreferencesDto } from './dtos/update-notification-preferences.dto';
import { plainToInstance } from 'class-transformer';

export type NotificationEventType =
  | 'newSubscriber'
  | 'postFromSubscribedCreator'
  | 'securityAlerts'
  | 'marketing';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferencesRepository: Repository<NotificationPreference>,
  ) {}

  async createDefaultPreferences(
    userId: number,
  ): Promise<NotificationPreference> {
    const existing = await this.preferencesRepository.findOneBy({ userId });
    if (existing) {
      return existing;
    }

    const preferences = this.preferencesRepository.create({
      userId,
      newSubscriber: true,
      postFromSubscribedCreator: true,
      securityAlerts: true,
      marketing: false,
    });

    return this.preferencesRepository.save(preferences);
  }

  async getPreferences(userId: number): Promise<NotificationPreferencesDto> {
    let preferences = await this.preferencesRepository.findOneBy({ userId });

    // Lazy-create on first GET if missing
    if (!preferences) {
      preferences = await this.createDefaultPreferences(userId);
    }

    return plainToInstance(NotificationPreferencesDto, preferences, {
      excludeExtraneousValues: true,
    });
  }

  async updatePreferences(
    userId: number,
    updateDto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    let preferences = await this.preferencesRepository.findOneBy({ userId });

    if (!preferences) {
      preferences = await this.createDefaultPreferences(userId);
    }

    // Identify invalid keys not present in the entity
    const allowedKeys = [
      'newSubscriber',
      'postFromSubscribedCreator',
      'securityAlerts',
      'marketing',
    ];
    const invalidKeys = Object.keys(updateDto).filter(
      (key) => !allowedKeys.includes(key),
    );
    if (invalidKeys.length > 0) {
      throw new BadRequestException(
        `Invalid preference keys: ${invalidKeys.join(', ')}`,
      );
    }

    Object.assign(preferences, updateDto);
    const updated = await this.preferencesRepository.save(preferences);

    return plainToInstance(NotificationPreferencesDto, updated, {
      excludeExtraneousValues: true,
    });
  }

  async shouldNotify(
    userId: number,
    eventType: NotificationEventType,
  ): Promise<boolean> {
    const allowedEvents: NotificationEventType[] = [
      'newSubscriber',
      'postFromSubscribedCreator',
      'securityAlerts',
      'marketing',
    ];

    if (!allowedEvents.includes(eventType)) {
      throw new BadRequestException('Invalid event type');
    }

    let preferences = await this.preferencesRepository.findOneBy({ userId });
    if (!preferences) {
      preferences = await this.createDefaultPreferences(userId);
    }

    return preferences[eventType];
  }
}
