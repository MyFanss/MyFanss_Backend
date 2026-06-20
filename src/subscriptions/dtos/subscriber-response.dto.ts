import { ApiProperty } from '@nestjs/swagger';

export class SubscriberResponseDto {
  @ApiProperty({ description: 'Subscription ID', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'ID of the subscribing fan' })
  fanId: number;

  @ApiProperty({ type: String, format: 'date-time' })
  subscribedAt: Date;
}
