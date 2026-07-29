import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmTipDto {
  @ApiPropertyOptional({
    description:
      'Idempotency key. Prefer the Idempotency-Key header; body field is a fallback.',
  })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description:
      'Stub-only: force this confirm to resolve as failed instead of completed. No real PSP is involved.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}
