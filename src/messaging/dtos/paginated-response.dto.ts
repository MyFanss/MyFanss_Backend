import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationResponseDto } from './conversation-response.dto';
import { MessageResponseDto } from './message-response.dto';

export class PaginatedConversationsResponseDto {
  @ApiProperty({ type: [ConversationResponseDto] })
  data: ConversationResponseDto[];

  @ApiPropertyOptional({
    description: 'Cursor to fetch the next page, or null if there is none',
    nullable: true,
  })
  nextCursor: string | null;

  @ApiProperty({ example: true })
  hasMore: boolean;
}

export class PaginatedMessagesResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  data: MessageResponseDto[];

  @ApiPropertyOptional({
    description: 'Cursor to fetch the next page, or null if there is none',
    nullable: true,
  })
  nextCursor: string | null;

  @ApiProperty({ example: true })
  hasMore: boolean;
}
