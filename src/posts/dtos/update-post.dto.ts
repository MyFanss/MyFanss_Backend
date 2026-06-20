import { IsString, MaxLength, IsOptional, IsEnum } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string | null;

  @IsOptional()
  @IsEnum(['public', 'subscribers'])
  visibility?: 'public' | 'subscribers';
}
