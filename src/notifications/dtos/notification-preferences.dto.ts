import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class NotificationPreferencesDto {
  @ApiProperty({ description: 'Preference for new subscriber notifications' })
  @Expose()
  newSubscriber: boolean;

  @ApiProperty({
    description: 'Preference for post from subscribed creator notifications',
  })
  @Expose()
  postFromSubscribedCreator: boolean;

  @ApiProperty({ description: 'Preference for security alerts' })
  @Expose()
  securityAlerts: boolean;

  @ApiProperty({ description: 'Preference for marketing communications' })
  @Expose()
  marketing: boolean;
}
