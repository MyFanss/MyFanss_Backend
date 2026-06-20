import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Owner-editable fields. The handle is immutable after onboarding so it can
 * stay a stable public identifier.
 */
export class UpdateCreatorDto {
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
