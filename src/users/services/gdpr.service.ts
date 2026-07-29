import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/audit-action.enum';
import { NotificationPreference } from '../../notifications/notification-preference.entity';
import { Subscription } from '../../subscriptions/subscription.entity';
import { AppLogger } from '../../logger/app-logger.service';
import {
  UserExportResponseDto,
  ExportedProfileDto,
  ExportedPreferenceDto,
  ExportedSubscriptionDto,
} from '../dtos/user-export-response.dto';

@Injectable()
export class GdprService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(NotificationPreference)
    private readonly preferencesRepository: Repository<NotificationPreference>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly auditService: AuditService,
    private readonly logger: AppLogger,
  ) {}

  async exportUserData(userId: number): Promise<UserExportResponseDto> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build profile — explicitly exclude password hash and tokens
    const profile: ExportedProfileDto = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      displayName: user.displayName ?? null,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    // Fetch notification preferences
    let preferences: ExportedPreferenceDto | null = null;
    const prefEntity = await this.preferencesRepository.findOneBy({ userId });
    if (prefEntity) {
      preferences = {
        newSubscriber: prefEntity.newSubscriber,
        postFromSubscribedCreator: prefEntity.postFromSubscribedCreator,
        securityAlerts: prefEntity.securityAlerts,
        marketing: prefEntity.marketing,
      };
    }

    // Fetch subscriptions (both as fan and creator)
    const subscriptionEntities = await this.subscriptionRepository.find({
      where: [{ fanId: userId }, { creatorId: userId }],
    });

    const subscriptions: ExportedSubscriptionDto[] = subscriptionEntities.map(
      (sub) => ({
        id: sub.id,
        fanId: sub.fanId,
        creatorId: sub.creatorId,
        status: sub.status,
        subscribedAt: sub.subscribedAt,
        cancelledAt: sub.cancelledAt ?? null,
      }),
    );

    // Audit the export
    void this.auditService.log({
      actorId: userId,
      action: AuditAction.GDPR_DATA_EXPORTED,
      targetType: 'User',
      targetId: userId,
      metadata: { exportedAt: new Date().toISOString() },
    });

    this.logger.log(
      `GDPR data exported for userId=${userId}`,
      GdprService.name,
    );

    return {
      profile,
      subscriptions,
      notificationPreferences: preferences,
      exportedAt: new Date(),
    };
  }

  async selfDeleteUser(userId: number): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete the user
    user.is_deleted = true;
    user.status = 'inactive';
    await this.userRepository.save(user);

    // Revoke all refresh tokens for this user
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );

    // Audit the self-delete
    void this.auditService.log({
      actorId: userId,
      action: AuditAction.USER_SELF_DELETED,
      targetType: 'User',
      targetId: userId,
      metadata: { softDelete: true, revokedSessions: true },
    });

    this.logger.log(`User self-deleted: userId=${userId}`, GdprService.name);
  }
}
