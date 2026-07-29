import { ApiProperty } from '@nestjs/swagger';
import { PostResponseDto } from './post-response.dto';

export class PaginatedPostsResponseDto {
  @ApiProperty({
    type: [PostResponseDto],
    description: 'Array of posts for this page',
  })
  data: PostResponseDto[];

  @ApiProperty({
    example: 53,
    description: 'Total number of posts matching the query',
  })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 10, description: 'Number of posts per page' })
  limit: number;

  @ApiProperty({ example: 6, description: 'Total number of pages' })
  totalPages: number;
}
