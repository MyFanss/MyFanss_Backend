import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({
    example: 42,
    description: 'ID of the creator to start (or resume) a conversation with',
  })
  @IsInt()
  creatorId: number;
}
