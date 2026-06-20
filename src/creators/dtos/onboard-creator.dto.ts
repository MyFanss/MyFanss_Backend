import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Lowercase letters, digits and underscores only, 3-30 characters.
 * Shared by the DTO validation, the service and the unit tests.
 */
export const HANDLE_REGEX = /^[a-z0-9_]{3,30}$/;

export class OnboardCreatorDto {
  @ApiProperty({
    description:
      'Public, URL-safe handle. Lowercase letters, digits and underscores, 3-30 chars.',
    pattern: '^[a-z0-9_]{3,30}$',
    example: 'jane_doe',
  })
  @IsString()
  @Matches(HANDLE_REGEX, {
    message:
      'handle must match ^[a-z0-9_]{3,30}$ (lowercase letters, digits, underscores, 3-30 chars)',
  })
  handle: string;

  @ApiPropertyOptional({ description: 'Public display name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Short bio (max 300 characters)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @ApiPropertyOptional({ description: 'URL to the banner image' })
  @IsOptional()
  @IsUrl()
  bannerUrl?: string;

  @ApiPropertyOptional({ description: 'Creator category', example: 'fitness' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;
}
