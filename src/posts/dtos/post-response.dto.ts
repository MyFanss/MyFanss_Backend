import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PostResponseDto {
  @ApiProperty({ example: 1, description: 'Unique post ID' })
  id: number;

  @ApiProperty({
    example: 7,
    description: 'ID of the creator who owns this post',
  })
  creatorId: number;

  @ApiProperty({ example: 'Behind the scenes', description: 'Post title' })
  title: string;

  @ApiProperty({
    example: 'Here is everything that happened...',
    description: 'Post body / content',
  })
  body: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/media/photo.jpg',
    description: 'Attached media URL',
    nullable: true,
  })
  mediaUrl?: string | null;

  @ApiProperty({
    example: 'public',
    enum: ['public', 'subscribers'],
    description: 'Visibility setting',
  })
  visibility: 'public' | 'subscribers';

  @ApiPropertyOptional({
    example: '2024-06-15T12:00:00.000Z',
    description: 'When the post was published, or null if still a draft',
    nullable: true,
  })
  publishedAt: Date | null;

  @ApiProperty({
    example: '2024-06-15T11:50:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-06-15T12:05:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    example: null,
    description: 'When the post was soft-deleted, or null if active',
    nullable: true,
  })
  deletedAt: Date | null;
}
