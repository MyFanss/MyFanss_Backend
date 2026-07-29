import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiPropertyOptional({
    example: 'eyJpZCI6MjB9',
    description: 'Opaque cursor to pass as `cursor` in the next request',
  })
  cursor?: string;

  @ApiProperty({
    example: true,
    description: 'Whether more records exist after this page',
  })
  hasMore: boolean;

  @ApiProperty({
    example: 243,
    description: 'Total number of records matching the query',
  })
  totalCount: number;

  @ApiProperty({ example: 20, description: 'Page size that was applied' })
  limit: number;

  @ApiPropertyOptional({
    example: { role: 'creator', status: 'active' },
    description: 'Active filter values echoed back for debugging',
  })
  appliedFilters?: Record<string, unknown>;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true, description: 'Page of results' })
  data: T[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
