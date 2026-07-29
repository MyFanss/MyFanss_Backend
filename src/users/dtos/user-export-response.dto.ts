import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExportedProfileDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ example: 'fan' })
  role: string;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiPropertyOptional({ example: 'JaneDoe', nullable: true })
  displayName?: string | null;

  @ApiPropertyOptional({
    example: 'Content creator and streamer',
    nullable: true,
  })
  bio?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatars/jane.jpg',
    nullable: true,
  })
  avatarUrl?: string | null;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' })
  updatedAt: Date;
}

export class ExportedPreferenceDto {
  @ApiProperty({ example: true })
  newSubscriber: boolean;

  @ApiProperty({ example: true })
  postFromSubscribedCreator: boolean;

  @ApiProperty({ example: true })
  securityAlerts: boolean;

  @ApiProperty({ example: false })
  marketing: boolean;
}

export class ExportedSubscriptionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 1 })
  fanId: number;

  @ApiProperty({ example: 2 })
  creatorId: number;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  subscribedAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  cancelledAt: Date | null;
}

export class UserExportResponseDto {
  @ApiProperty({ type: ExportedProfileDto })
  profile: ExportedProfileDto;

  @ApiProperty({ type: [ExportedSubscriptionDto] })
  subscriptions: ExportedSubscriptionDto[];

  @ApiPropertyOptional({ type: ExportedPreferenceDto, nullable: true })
  notificationPreferences?: ExportedPreferenceDto | null;

  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' })
  exportedAt: Date;
}
