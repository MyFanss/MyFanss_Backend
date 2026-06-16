import { Expose, Type } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  role: string;

  @Expose()
  status: string;

  @Expose()
  org_id?: number;

  @Expose()
  @Type(() => Date)
  created_at: Date;

  @Expose()
  @Type(() => Date)
  updated_at: Date;

  @Expose()
  message?: string;

  @Expose()
  relevanceScore?: number;
}
