import {
  IsOptional,
  IsInt,
  IsString,
  Min,
  Max,
  IsArray,
  IsDateString,
  IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetUsersQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for keyset pagination (base64-encoded)',
    example: 'eyJpZCI6MTB9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Page size (1–100)',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Full-text search on name and email',
    example: 'jane',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by role(s), comma-separated',
    example: 'creator,fan',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  role?: string[];

  @ApiPropertyOptional({
    description: 'Filter by status(es), comma-separated',
    example: 'active,inactive',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  status?: string[];

  @ApiPropertyOptional({
    description: 'Filter by organisation ID(s), comma-separated',
    example: '1,2,3',
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(Number);
    }
    return value;
  })
  org_id?: number[];

  @ApiPropertyOptional({
    description: 'Created-at range start (ISO 8601)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  created_from?: string;

  @ApiPropertyOptional({
    description: 'Created-at range end (ISO 8601)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  created_to?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['name', 'email', 'created_at', 'role', 'status', 'relevance'],
    default: 'created_at',
  })
  @IsOptional()
  @IsString()
  @IsIn(['name', 'email', 'created_at', 'role', 'status', 'relevance'])
  sort_by?: string = 'created_at';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC'])
  sort_order?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({
    description: 'DEPRECATED – use cursor instead. Offset-based page number',
    example: 1,
    deprecated: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'DEPRECATED – use limit instead. Page size for offset pagination',
    example: 20,
    deprecated: true,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;
}
