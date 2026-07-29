import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Post } from './post.entity';
import { CreatePostDto } from './dtos/create-post.dto';
import { UpdatePostDto } from './dtos/update-post.dto';
import { PaginatedPostsResponseDto } from './dtos/paginated-posts-response.dto';
import { PostResponseDto } from './dtos/post-response.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.enum';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private postsRepo: Repository<Post>,
    private readonly auditService: AuditService,
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

  async getArchivedPosts(
    creatorId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedPostsResponseDto> {
    const skip = (page - 1) * limit;

    const [posts, total] = await this.postsRepo.findAndCount({
      where: { creatorId, deletedAt: Not(IsNull()) },
      order: { deletedAt: 'DESC' },
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

  async getPublicCreatorPosts(
    creatorId: number,
    isSubscriber: boolean,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedPostsResponseDto> {
    const skip = (page - 1) * limit;

    let query = this.postsRepo
      .createQueryBuilder('post')
      .where('post.creatorId = :creatorId', { creatorId })
      .andWhere('post.deletedAt IS NULL');

    if (!isSubscriber) {
      query = query.andWhere('post.visibility = :visibility', {
        visibility: 'public',
      });
    }

    const [posts, total] = await query
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

  async getPostById(postId: number): Promise<PostResponseDto> {
    const post = await this.postsRepo.findOne({
      where: { id: postId, deletedAt: IsNull() },
    });
    if (!post) throw new NotFoundException('Post not found');
    return this.toDto(post);
  }

  /**
   * Enforcement point for future engagement features (likes/comments): a
   * missing or soft-deleted post must behave identically — 404. See
   * docs/post-lifecycle.md for the full contract.
   */
  async assertPostIsEngageable(postId: number): Promise<Post> {
    const post = await this.postsRepo.findOne({
      where: { id: postId, deletedAt: IsNull() },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
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
    const post = await this.postsRepo.findOne({ where: { id: postId } });

    if (!post) throw new NotFoundException('Post not found');
    if (post.creatorId !== creatorId)
      throw new ForbiddenException("Cannot delete another creator's post");

    if (post.deletedAt) {
      // Already deleted — idempotent no-op.
      return;
    }

    post.deletedAt = new Date();
    post.deletedById = creatorId;
    await this.postsRepo.save(post);

    void this.auditService.log({
      actorId: creatorId,
      action: AuditAction.POST_SOFT_DELETED,
      targetType: 'Post',
      targetId: postId,
    });
  }

  async restorePost(
    postId: number,
    creatorId: number,
  ): Promise<PostResponseDto> {
    const post = await this.postsRepo.findOne({ where: { id: postId } });

    if (!post) throw new NotFoundException('Post not found');
    if (post.creatorId !== creatorId)
      throw new ForbiddenException("Cannot restore another creator's post");

    if (!post.deletedAt) {
      throw new ConflictException('Post is not deleted');
    }

    post.deletedAt = null;
    post.deletedById = null;
    const restored = await this.postsRepo.save(post);

    void this.auditService.log({
      actorId: creatorId,
      action: AuditAction.POST_RESTORED,
      targetType: 'Post',
      targetId: postId,
    });

    return this.toDto(restored);
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
      deletedAt: post.deletedAt,
    };
  }
}
