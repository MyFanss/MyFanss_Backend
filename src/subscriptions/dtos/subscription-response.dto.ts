import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionStatus } from '../subscription.entity';

export class SubscriptionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'ID of the subscribing fan' })
  fanId: number;

  @ApiProperty({ description: 'ID of the subscribed-to creator' })
  creatorId: number;

  @ApiProperty({ enum: ['active', 'cancelled'] })
  status: SubscriptionStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  subscribedAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cancelledAt: Date | null;
}
