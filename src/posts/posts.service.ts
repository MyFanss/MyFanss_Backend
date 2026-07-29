import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Post } from './post.entity';
import { CreatePostDto } from './dtos/create-post.dto';
import { UpdatePostDto } from './dtos/update-post.dto';
import { PaginatedPostsResponseDto } from './dtos/paginated-posts-response.dto';
import { PostResponseDto } from './dtos/post-response.dto';
import { CreatorsService } from '../creators/creators.service';
import { PostVisibilityService, PostViewer } from './post-visibility.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private postsRepo: Repository<Post>,
    private readonly creatorsService: CreatorsService,
    private readonly postVisibilityService: PostVisibilityService,
  ) {}

  async createPost(
    creatorId: number,
    dto: CreatePostDto,
  ): Promise<PostResponseDto> {
    const post = this.postsRepo.create({
      creatorId,
      title: dto.title,
      body: dto.body,
      mediaUrl: dto.mediaUrl || null,
      visibility: dto.visibility,
      publishedAt: new Date(),
    });

    const saved = await this.postsRepo.save(post);
    return this.toDto(saved);
  }

  /**
   * Owner's own view of their posts (GET /creators/me/posts). No visibility
   * filtering — an owner always sees all of their own non-deleted posts.
   */
  async getCreatorPosts(
    creatorId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedPostsResponseDto> {
    const skip = (page - 1) * limit;

    const [posts, total] = await this.postsRepo.findAndCount({
      where: { creatorId, deletedAt: IsNull() },
      order: { publishedAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: posts.map((p) => this.toDto(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Public read path: GET /creators/:handle/posts. Resolves the handle via
   * CreatorsService (the single handle-resolution authority — see
   * docs/post-visibility.md), then checks subscriber access ONCE for the
   * whole request rather than once per post, so this never becomes an N+1
   * query as the page grows.
   */
  async getPostsByHandle(
    handle: string,
    viewer: PostViewer | undefined,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedPostsResponseDto> {
    const creatorUserId =
      await this.creatorsService.getCreatorUserIdByHandle(handle);
    const includeSubscriberOnly =
      await this.postVisibilityService.canViewSubscriberContent(
        viewer,
        creatorUserId,
      );

    const skip = (page - 1) * limit;
    const qb = this.postsRepo
      .createQueryBuilder('post')
      .where('post.creatorId = :creatorId', { creatorId: creatorUserId })
      .andWhere('post.deletedAt IS NULL');

    if (!includeSubscriberOnly) {
      qb.andWhere('post.visibility = :visibility', { visibility: 'public' });
    }

    const [posts, total] = await qb
      .orderBy('post.publishedAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: posts.map((p) => this.toDto(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Public read path: GET /creators/:handle/posts/:postId. Same visibility
   * rules as the list endpoint. Returns a plain 404 (not 403) whether the
   * post doesn't exist, is deleted, or exists but is unauthorized for this
   * viewer — this endpoint never confirms the existence of subscriber-only
   * content to an unauthorized caller.
   */
  async getPostByHandle(
    handle: string,
    postId: number,
    viewer: PostViewer | undefined,
  ): Promise<PostResponseDto> {
    const creatorUserId =
      await this.creatorsService.getCreatorUserIdByHandle(handle);

    const post = await this.postsRepo.findOne({
      where: { id: postId, creatorId: creatorUserId, deletedAt: IsNull() },
    });

    const notFound = () => new NotFoundException('Post not found');
    if (!post) throw notFound();

    const canView = await this.postVisibilityService.canViewPost(
      post,
      viewer,
      creatorUserId,
    );
    if (!canView) throw notFound();

    return this.toDto(post);
  }

  async updatePost(
    postId: number,
    creatorId: number,
    dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    const post = await this.postsRepo.findOne({
      where: { id: postId, deletedAt: IsNull() },
    });

    if (!post) throw new NotFoundException('Post not found');
    if (post.creatorId !== creatorId)
      throw new ForbiddenException("Cannot edit another creator's post");

    Object.assign(post, dto);
    const updated = await this.postsRepo.save(post);
    return this.toDto(updated);
  }

  async deletePost(postId: number, creatorId: number): Promise<void> {
    const post = await this.postsRepo.findOne({
      where: { id: postId, deletedAt: IsNull() },
    });

    if (!post) throw new NotFoundException('Post not found');
    if (post.creatorId !== creatorId)
      throw new ForbiddenException("Cannot delete another creator's post");

    post.deletedAt = new Date();
    await this.postsRepo.save(post);
  }

  private toDto(post: Post): PostResponseDto {
    return {
      id: post.id,
      creatorId: post.creatorId,
      title: post.title,
      body: post.body,
      mediaUrl: post.mediaUrl,
      visibility: post.visibility,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
