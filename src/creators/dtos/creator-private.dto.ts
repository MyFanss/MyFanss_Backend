import { ApiProperty } from '@nestjs/swagger';
import { CreatorResponseDto } from './creator-response.dto';

/**
 * Owner view returned by POST /creators/onboard and PATCH /creators/me.
 *
 * Extends the public view with owner-only metadata (id, userId, onboarding
 * status, updatedAt). Still never includes email/password.
 */
export class CreatorPrivateDto extends CreatorResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'ID of the owning user account' })
  userId: number;

  @ApiProperty({ example: true })
  isOnboarded: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
