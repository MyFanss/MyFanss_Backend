import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { Post } from './post.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.enum';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

describe('PostsService', () => {
  let service: PostsService;
  let mockPostsRepo: any;
  let mockAuditService: any;

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
    deletedById: null,
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

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: mockPostsRepo,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
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
    it('should return paginated posts', async () => {
      const posts = [mockPost];
      mockPostsRepo.findAndCount.mockResolvedValue([posts, 1]);

      const result = await service.getCreatorPosts(1, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
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

  describe('getArchivedPosts', () => {
    it('should return only soft-deleted posts', async () => {
      const deletedPost = { ...mockPost, id: 2, deletedAt: new Date() };
      mockPostsRepo.findAndCount.mockResolvedValue([[deletedPost], 1]);

      const result = await service.getArchivedPosts(1, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      const callArgs = mockPostsRepo.findAndCount.mock.calls[0][0];
      expect(callArgs.where.creatorId).toBe(1);
      expect(callArgs.where.deletedAt._type).toBe('not');
    });
  });

  describe('getPublicCreatorPosts', () => {
    it('should only return public posts for non-subscribers', async () => {
      const publicPost = { ...mockPost, visibility: 'public' };
      mockPostsRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[publicPost], 1]),
      });

      const result = await service.getPublicCreatorPosts(1, false, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter out soft-deleted posts', async () => {
      const andWhere = jest.fn().mockReturnThis();
      mockPostsRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere,
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });

      await service.getPublicCreatorPosts(1, false, 1, 10);

      expect(andWhere).toHaveBeenCalledWith('post.deletedAt IS NULL');
    });

    it('should return all posts for subscribers', async () => {
      const allPosts = [
        mockPost,
        { ...mockPost, id: 2, visibility: 'subscribers' },
      ];
      mockPostsRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([allPosts, 2]),
      });

      const result = await service.getPublicCreatorPosts(1, true, 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
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
    it('should soft-delete a post by owner', async () => {
      mockPostsRepo.findOne.mockResolvedValue({ ...mockPost });
      mockPostsRepo.save.mockImplementation((p) => Promise.resolve(p));

      await service.deletePost(1, 1);

      expect(mockPostsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedById: 1,
        }),
      );
      expect(mockPostsRepo.remove).not.toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 1,
          action: AuditAction.POST_SOFT_DELETED,
          targetType: 'Post',
          targetId: 1,
        }),
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
