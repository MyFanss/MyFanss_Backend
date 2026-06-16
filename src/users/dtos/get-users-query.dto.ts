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

export class GetUsersQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  role?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  status?: string[];

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

  @IsOptional()
  @IsDateString()
  created_from?: string;

  @IsOptional()
  @IsDateString()
  created_to?: string;

  @IsOptional()
  @IsString()
  @IsIn(['name', 'email', 'created_at', 'role', 'status', 'relevance'])
  sort_by?: string = 'created_at';

  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC'])
  sort_order?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;
}
