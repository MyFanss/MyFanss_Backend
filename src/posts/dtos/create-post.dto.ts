import { IsString, MaxLength, IsOptional, IsEnum } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(5000)
  body: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsEnum(['public', 'subscribers'])
  visibility: 'public' | 'subscribers';
}
