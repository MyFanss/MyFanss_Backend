import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ example: 1, description: 'Unique message ID' })
  id: number;

  @ApiProperty({
    example: 5,
    description: 'ID of the conversation this message belongs to',
  })
  conversationId: number;

  @ApiProperty({
    example: 7,
    description: 'ID of the user who sent this message',
  })
  senderId: number;

  @ApiProperty({ example: 'Hey, thanks for subscribing!' })
  body: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-uuid-from-client',
    nullable: true,
    description:
      'Client-generated idempotency key, if one was supplied on send',
  })
  clientId: string | null;

  @ApiProperty({ example: '2024-06-15T12:05:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'When the recipient read this message, or null if unread',
  })
  readAt: Date | null;
}
