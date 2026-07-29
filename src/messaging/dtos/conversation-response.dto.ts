import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConversationResponseDto {
  @ApiProperty({ example: 1, description: 'Unique conversation ID' })
  id: number;

  @ApiProperty({
    example: 7,
    description: 'ID of the fan in this conversation',
  })
  fanId: number;

  @ApiProperty({
    example: 42,
    description: 'ID of the creator in this conversation',
  })
  creatorId: number;

  @ApiProperty({
    example: '2024-06-15T12:05:00.000Z',
    description:
      'Timestamp of the most recent message (or creation time, if none yet)',
  })
  lastMessageAt: Date;

  @ApiPropertyOptional({
    example: 'Hey, thanks for subscribing!',
    description: 'Preview of the most recent message body, or null if none yet',
    nullable: true,
  })
  lastMessagePreview: string | null;

  @ApiProperty({ example: '2024-06-15T11:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-06-15T12:05:00.000Z' })
  updatedAt: Date;
}
