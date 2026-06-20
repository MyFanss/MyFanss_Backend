import { ApiProperty } from '@nestjs/swagger';

/**
 * Public creator view returned by GET /creators/:handle.
 *
 * Deliberately excludes userId and any User fields (email/password) so the
 * public endpoint never leaks account credentials or internal identifiers.
 */
export class CreatorResponseDto {
  @ApiProperty({ example: 'jane_doe' })
  handle: string;

  @ApiProperty({ nullable: true, example: 'Jane Doe' })
  displayName: string | null;

  @ApiProperty({ nullable: true, example: 'Fitness coach & nutritionist' })
  bio: string | null;

  @ApiProperty({ nullable: true, example: 'https://cdn.myfans.dev/banner.jpg' })
  bannerUrl: string | null;

  @ApiProperty({ nullable: true, example: 'fitness' })
  category: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}
