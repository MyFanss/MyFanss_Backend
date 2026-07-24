import { IsString, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({
    example: 'Behind the scenes of my latest shoot',
    description: 'Post title (max 200 characters)',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example: 'Here is everything that happened during the shoot...',
    description: 'Post body / content (max 5000 characters)',
    maxLength: 5000,
  })
  @IsString()
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/media/photo.jpg',
    description: 'Optional URL of attached media (image, video, etc.)',
  })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiProperty({
    example: 'public',
    enum: ['public', 'subscribers'],
    description: 'Who can see this post',
  })
  @IsEnum(['public', 'subscribers'])
  visibility: 'public' | 'subscribers';
}
