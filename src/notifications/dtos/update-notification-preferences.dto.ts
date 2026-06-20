import { PartialType } from '@nestjs/swagger';
import { NotificationPreferencesDto } from './notification-preferences.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto extends PartialType(
  NotificationPreferencesDto,
) {
  @IsOptional()
  @IsBoolean()
  newSubscriber?: boolean;

  @IsOptional()
  @IsBoolean()
  postFromSubscribedCreator?: boolean;

  @IsOptional()
  @IsBoolean()
  securityAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  marketing?: boolean;
}
