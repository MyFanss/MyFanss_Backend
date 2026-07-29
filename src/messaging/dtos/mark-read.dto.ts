import { IsDateString, IsInt, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MarkReadDto {
  @ApiPropertyOptional({
    example: 128,
    description:
      'Mark all messages from the other participant up to (and including) this message ID as read.',
  })
  @IsOptional()
  @IsInt()
  messageId?: number;

  @ApiPropertyOptional({
    example: '2024-06-15T12:05:00.000Z',
    description:
      'Mark all messages from the other participant sent at or before this timestamp as read. ' +
      'Ignored if messageId is provided. Defaults to now when neither is provided.',
  })
  @IsOptional()
  @IsDateString()
  readAt?: string;
}
