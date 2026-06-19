export class PostResponseDto {
  id: number;
  creatorId: number;
  title: string;
  body: string;
  mediaUrl?: string | null;
  visibility: 'public' | 'subscribers';
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
