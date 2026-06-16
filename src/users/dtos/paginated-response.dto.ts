export class PaginationMetaDto {
  cursor?: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  appliedFilters?: Record<string, unknown>;
}

export class PaginatedResponseDto<T> {
  data: T[];
  pagination: PaginationMetaDto;
}
