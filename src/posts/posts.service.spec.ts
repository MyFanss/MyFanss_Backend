import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { Post } from './post.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('PostsService', () => {
  let service: PostsService;
  let mockPostsRepo: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: mockPostsRepo,
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

      const postWithMedia = { ...mockPost, mediaUrl: 'https://example.com/image.jpg' };
      mockPostsRepo.create.mockReturnValue(postWithMedia);
      mockPostsRepo.save.mockResolvedValue(postWithMedia);

      const result = await service.createPost(1, dto);

      expect(result.mediaUrl).toBe('https://example.com/image.jpg');
    });
  });

  describe('getCreatorPosts', () => {
    it('should return paginated posts for creator', async () => {
      const posts = [mockPost];
      mockPostsRepo.findAndCount.mockResolvedValue([posts, 1]);

      const result = await service.getCreatorPosts(1, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should calculate pagination correctly', async () => {
      const posts = Array(10).fill(mockPost);
      mockPostsRepo.findAndCount.mockResolvedValue([posts, 25]);

      const result = await service.getCreatorPosts(1, 2, 10);

      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
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

    it('should return all posts for subscribers', async () => {
      const allPosts = [mockPost, { ...mockPost, id: 2, visibility: 'subscribers' }];
      mockPostsRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
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

      await expect(service.updatePost(1, 999, { title: 'Updated Title' }))
        .rejects
        .toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if post does not exist', async () => {
      mockPostsRepo.findOne.mockResolvedValue(null);

      await expect(service.updatePost(999, 1, { title: 'Updated Title' }))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('deletePost', () => {
    it('should delete a post by owner', async () => {
      mockPostsRepo.findOne.mockResolvedValue(mockPost);

      await service.deletePost(1, 1);

      expect(mockPostsRepo.remove).toHaveBeenCalledWith(mockPost);
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
  });
});
