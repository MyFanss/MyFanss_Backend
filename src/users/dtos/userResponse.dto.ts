import { Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 1, description: 'Unique user ID' })
  @Expose()
  id: number;

  @ApiProperty({ example: 'Jane Doe', description: 'Full name' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'jane@example.com', description: 'Email address' })
  @Expose()
  email: string;

  @ApiProperty({
    example: 'fan',
    enum: ['fan', 'creator', 'admin'],
    description: 'User role',
  })
  @Expose()
  role: string;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'inactive', 'suspended'],
    description: 'Account status',
  })
  @Expose()
  status: string;

  @ApiPropertyOptional({ example: 42, description: 'Organisation ID' })
  @Expose()
  org_id?: number;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Created at timestamp' })
  @Expose()
  @Type(() => Date)
  created_at: Date;

  @ApiProperty({ example: '2024-06-01T08:00:00.000Z', description: 'Last updated timestamp' })
  @Expose()
  @Type(() => Date)
  updated_at: Date;

  @ApiPropertyOptional({ example: 'JaneDoe', description: 'Public display name', nullable: true })
  @Expose()
  displayName?: string | null;

  @ApiPropertyOptional({ example: 'Content creator and streamer', description: 'Profile bio', nullable: true })
  @Expose()
  bio?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatars/jane.jpg',
    description: 'Avatar image URL',
    nullable: true,
  })
  @Expose()
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: 'user created successfully', description: 'Operation message' })
  @Expose()
  message?: string;

  @ApiPropertyOptional({ example: 0.95, description: 'Search relevance score (0-1)' })
  @Expose()
  relevanceScore?: number;
}
