import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    example: 'Hey, thanks for subscribing!',
    description: 'Message body (1-2000 characters after trimming)',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-uuid-from-client',
    description:
      'Client-generated ID for idempotent sends. Resending the same clientId ' +
      'for a conversation/sender pair returns the original message instead of ' +
      'creating a duplicate.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientId?: string;
}
