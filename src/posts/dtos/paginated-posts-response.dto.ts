import { PostResponseDto } from './post-response.dto';

export class PaginatedPostsResponseDto {
  data: PostResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
