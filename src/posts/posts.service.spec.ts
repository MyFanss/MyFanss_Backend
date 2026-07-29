import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post } from './post.entity';
import { CreatorsService } from '../creators/creators.service';
import { PostVisibilityService } from './post-visibility.service';

describe('PostsService', () => {
  let service: PostsService;
  let mockPostsRepo: any;
  let creatorsService: jest.Mocked<
    Pick<CreatorsService, 'getCreatorUserIdByHandle'>
  >;
  let visibilityService: jest.Mocked<
    Pick<PostVisibilityService, 'canViewSubscriberContent' | 'canViewPost'>
  >;

  const mockPost = {
    id: 1,
    creatorId: 1,
    title: 'Test Post',
    body: 'Test body',
    mediaUrl: null,
    visibility: 'public',
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    mockPostsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn(),
      remove: jest.fn(),
    };

    creatorsService = {
      getCreatorUserIdByHandle: jest.fn(),
    };

    visibilityService = {
      canViewSubscriberContent: jest.fn(),
      canViewPost: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: mockPostsRepo,
        },
        { provide: CreatorsService, useValue: creatorsService },
        { provide: PostVisibilityService, useValue: visibilityService },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPost', () => {
    it('should create a post', async () => {
      const dto = {
        title: 'Test Post',
        body: 'Test body',
        visibility: 'public' as const,
      };

      mockPostsRepo.create.mockReturnValue(mockPost);
      mockPostsRepo.save.mockResolvedValue(mockPost);

      const result = await service.createPost(1, dto);

      expect(result).toEqual({
        id: mockPost.id,
        creatorId: mockPost.creatorId,
        title: mockPost.title,
        body: mockPost.body,
        mediaUrl: mockPost.mediaUrl,
        visibility: mockPost.visibility,
        publishedAt: mockPost.publishedAt,
        createdAt: mockPost.createdAt,
        updatedAt: mockPost.updatedAt,
        deletedAt: mockPost.deletedAt,
      });
      expect(mockPostsRepo.create).toHaveBeenCalled();
      expect(mockPostsRepo.save).toHaveBeenCalled();
    });

    it('should include mediaUrl if provided', async () => {
      const dto = {
        title: 'Test Post',
        body: 'Test body',
        mediaUrl: 'https://example.com/image.jpg',
        visibility: 'public' as const,
      };

      const postWithMedia = {
        ...mockPost,
        mediaUrl: 'https://example.com/image.jpg',
      };
      mockPostsRepo.create.mockReturnValue(postWithMedia);
      mockPostsRepo.save.mockResolvedValue(postWithMedia);

      const result = await service.createPost(1, dto);

      expect(result.mediaUrl).toBe('https://example.com/image.jpg');
    });
  });

  describe('getCreatorPosts', () => {
    it('should return paginated posts for creator, filtering deleted posts', async () => {
      const posts = [mockPost];
      mockPostsRepo.findAndCount.mockResolvedValue([posts, 1]);

      const result = await service.getCreatorPosts(1, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(mockPostsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ creatorId: 1 }),
        }),
      );
    });

    it('should exclude soft-deleted posts', async () => {
      mockPostsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getCreatorPosts(1, 1, 10);

      const callArgs = mockPostsRepo.findAndCount.mock.calls[0][0];
      expect(callArgs.where.creatorId).toBe(1);
      expect(callArgs.where.deletedAt._type).toBe('isNull');
    });

    it('should calculate pagination correctly', async () => {
      const posts = Array(10).fill(mockPost);
      mockPostsRepo.findAndCount.mockResolvedValue([posts, 25]);

      const result = await service.getCreatorPosts(1, 2, 10);

      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
    });
  });

  describe('getPostsByHandle', () => {
    function mockQueryBuilder(returned: [any[], number]) {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue(returned),
      };
      mockPostsRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('resolves the handle via CreatorsService, not by treating it as a primary key', async () => {
      creatorsService.getCreatorUserIdByHandle.mockResolvedValue(1);
      visibilityService.canViewSubscriberContent.mockResolvedValue(false);
      mockQueryBuilder([[mockPost], 1]);

      await service.getPostsByHandle('creator_one', undefined, 1, 10);

      expect(creatorsService.getCreatorUserIdByHandle).toHaveBeenCalledWith(
        'creator_one',
      );
    });

    it('only returns public posts for an anonymous caller', async () => {
      creatorsService.getCreatorUserIdByHandle.mockResolvedValue(1);
      visibilityService.canViewSubscriberContent.mockResolvedValue(false);
      const qb = mockQueryBuilder([[mockPost], 1]);

      const result = await service.getPostsByHandle(
        'creator_one',
        undefined,
        1,
        10,
      );

      expect(result.data).toHaveLength(1);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('visibility'),
        { visibility: 'public' },
      );
      expect(visibilityService.canViewSubscriberContent).toHaveBeenCalledWith(
        undefined,
        1,
      );
    });

    it('checks subscriber access once per request, not once per post (no N+1)', async () => {
      creatorsService.getCreatorUserIdByHandle.mockResolvedValue(1);
      visibilityService.canViewSubscriberContent.mockResolvedValue(true);
      const manyPosts = Array(20).fill(mockPost);
      const qb = mockQueryBuilder([manyPosts, 20]);

      await service.getPostsByHandle('creator_one', { userId: 42 }, 1, 20);

      expect(visibilityService.canViewSubscriberContent).toHaveBeenCalledTimes(
        1,
      );
      // No visibility-narrowing clause added once subscriber content is unlocked.
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('visibility'),
        expect.anything(),
      );
    });
  });

  describe('getPostByHandle', () => {
    it('returns 404 when the post does not exist for that creator', async () => {
      creatorsService.getCreatorUserIdByHandle.mockResolvedValue(1);
      mockPostsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getPostByHandle('creator_one', 999, undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 404 (not 403) when the post exists but is not visible to the caller', async () => {
      creatorsService.getCreatorUserIdByHandle.mockResolvedValue(1);
      const subscriberPost = { ...mockPost, visibility: 'subscribers' };
      mockPostsRepo.findOne.mockResolvedValue(subscriberPost);
      visibilityService.canViewPost.mockResolvedValue(false);

      await expect(
        service.getPostByHandle('creator_one', 1, undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the post when visible', async () => {
      creatorsService.getCreatorUserIdByHandle.mockResolvedValue(1);
      mockPostsRepo.findOne.mockResolvedValue(mockPost);
      visibilityService.canViewPost.mockResolvedValue(true);

      const result = await service.getPostByHandle('creator_one', 1, {
        userId: 1,
      });

      expect(result.id).toBe(1);
    });
  });

  describe('getPostById', () => {
    it('should throw NotFoundException for a soft-deleted post', async () => {
      mockPostsRepo.findOne.mockResolvedValue(null);

      await expect(service.getPostById(1)).rejects.toThrow(NotFoundException);
      expect(mockPostsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 1 }) }),
      );
    });
  });

  describe('updatePost', () => {
    it('should update a post by owner', async () => {
      mockPostsRepo.findOne.mockResolvedValue(mockPost);
      mockPostsRepo.save.mockResolvedValue({
        ...mockPost,
        title: 'Updated Title',
      });

      const result = await service.updatePost(1, 1, { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockPostsRepo.findOne.mockResolvedValue(mockPost);

      await expect(
        service.updatePost(1, 999, { title: 'Updated Title' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if post does not exist', async () => {
      mockPostsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updatePost(999, 1, { title: 'Updated Title' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if post is soft-deleted', async () => {
      mockPostsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updatePost(1, 1, { title: 'Updated Title' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePost', () => {
    it('soft-deletes a post by owner (sets deletedAt, never removes the row)', async () => {
      mockPostsRepo.findOne.mockResolvedValue({ ...mockPost });
      mockPostsRepo.save.mockImplementation(async (p: any) => p);

      await service.deletePost(1, 1);

      expect(mockPostsRepo.remove).not.toHaveBeenCalled();
      expect(mockPostsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockPostsRepo.findOne.mockResolvedValue(mockPost);

      await expect(service.deletePost(1, 999)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if post does not exist', async () => {
      mockPostsRepo.findOne.mockResolvedValue(null);

      await expect(service.deletePost(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should be idempotent — deleting an already-deleted post is a no-op', async () => {
      mockPostsRepo.findOne.mockResolvedValue({
        ...mockPost,
        deletedAt: new Date(),
        deletedById: 1,
      });

      await service.deletePost(1, 1);

      expect(mockPostsRepo.save).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  describe('restorePost', () => {
    it('should restore a soft-deleted post by owner', async () => {
      mockPostsRepo.findOne.mockResolvedValue({
        ...mockPost,
        deletedAt: new Date(),
        deletedById: 1,
      });
      mockPostsRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.restorePost(1, 1);

      expect(result.deletedAt).toBeNull();
      expect(mockPostsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null, deletedById: null }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 1,
          action: AuditAction.POST_RESTORED,
          targetType: 'Post',
          targetId: 1,
        }),
      );
    });

    it('should throw NotFoundException if post does not exist', async () => {
      mockPostsRepo.findOne.mockResolvedValue(null);

      await expect(service.restorePost(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw ForbiddenException when restoring another creator's post", async () => {
      mockPostsRepo.findOne.mockResolvedValue({
        ...mockPost,
        deletedAt: new Date(),
      });

      await expect(service.restorePost(1, 999)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException when the post is not deleted', async () => {
      mockPostsRepo.findOne.mockResolvedValue({ ...mockPost, deletedAt: null });

      await expect(service.restorePost(1, 1)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPostsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('assertPostIsEngageable', () => {
    it('should return the post when active', async () => {
      mockPostsRepo.findOne.mockResolvedValue(mockPost);

      const result = await service.assertPostIsEngageable(1);

      expect(result).toEqual(mockPost);
    });

    it('should throw NotFoundException for a missing or soft-deleted post', async () => {
      mockPostsRepo.findOne.mockResolvedValue(null);

      await expect(service.assertPostIsEngageable(1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
