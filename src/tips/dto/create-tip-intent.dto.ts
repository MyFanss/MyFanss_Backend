import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTipIntentDto {
  @ApiProperty({ description: 'Creator being tipped', example: 3 })
  @IsInt()
  creatorId: number;

  @ApiProperty({
    description: 'Tip amount in cents (before fees)',
    example: 500,
  })
  @IsInt()
  @IsPositive()
  amountCents: number;

  @ApiPropertyOptional({
    description: 'ISO 4217 currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Optional message to the creator',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional({
    description:
      'Idempotency key. Prefer the Idempotency-Key header; body field is a fallback for clients that cannot set headers.',
  })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description:
      'Stub-only: force the confirm step to fail instead of succeed. No real PSP is involved.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}
