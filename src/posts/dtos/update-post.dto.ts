import { IsString, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePostDto {
  @ApiPropertyOptional({
    example: 'Updated title here',
    description: 'New post title (max 200 characters)',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example: 'Updated body content...',
    description: 'New post body (max 5000 characters)',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/media/new-photo.jpg',
    description: 'Replacement media URL, or null to remove existing media',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  mediaUrl?: string | null;

  @ApiPropertyOptional({
    example: 'subscribers',
    enum: ['public', 'subscribers'],
    description: 'Updated visibility setting',
  })
  @IsOptional()
  @IsEnum(['public', 'subscribers'])
  visibility?: 'public' | 'subscribers';
}
