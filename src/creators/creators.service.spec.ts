import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreatorsService } from './creators.service';
import { CreatorProfile } from './creator-profile.entity';
import { User } from '../users/user.entity';

describe('CreatorsService', () => {
  let service: CreatorsService;
  let creatorRepo: jest.Mocked<Repository<CreatorProfile>>;
  let userRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorsService,
        {
          provide: getRepositoryToken(CreatorProfile),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CreatorsService);
    creatorRepo = module.get(getRepositoryToken(CreatorProfile));
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('onboard', () => {
    it('rejects an invalid handle format before touching the database', async () => {
      await expect(
        service.onboard(1, { handle: 'Invalid Handle!' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFound when the user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.onboard(1, { handle: 'jane_doe' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 409 when the user has already onboarded', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, role: 'creator' } as User);
      creatorRepo.findOne.mockResolvedValueOnce({
        id: 'uuid-1',
        userId: 1,
      } as CreatorProfile);

      await expect(
        service.onboard(1, { handle: 'jane_doe' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(creatorRepo.save).not.toHaveBeenCalled();
    });

    it('returns 409 when the handle is already taken', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, role: 'user' } as User);
      creatorRepo.findOne
        .mockResolvedValueOnce(null) // no existing profile for this user
        .mockResolvedValueOnce({
          id: 'uuid-2',
          userId: 2,
          handle: 'jane_doe',
        } as CreatorProfile); // handle taken by someone else

      await expect(
        service.onboard(1, { handle: 'jane_doe' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(creatorRepo.save).not.toHaveBeenCalled();
    });

    it('creates the profile, upgrades the user role and returns the private dto', async () => {
      const user = { id: 1, role: 'user' } as User;
      userRepo.findOne.mockResolvedValue(user);
      creatorRepo.findOne.mockResolvedValue(null);
      creatorRepo.create.mockImplementation((p) => p as CreatorProfile);
      creatorRepo.save.mockImplementation(async (p) => ({
        ...(p as CreatorProfile),
        id: 'uuid-new',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const result = await service.onboard(1, {
        handle: 'jane_doe',
        displayName: 'Jane',
        bio: 'Coach',
      });

      expect(result).toMatchObject({
        id: 'uuid-new',
        userId: 1,
        handle: 'jane_doe',
        displayName: 'Jane',
        bio: 'Coach',
        isOnboarded: true,
      });
      // RBAC upgrade persisted.
      expect(user.role).toBe('creator');
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'creator' }),
      );
      // Private dto must never carry account credentials.
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('password');
    });

    it('normalizes the handle by trimming and lowercasing', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, role: 'creator' } as User);
      creatorRepo.findOne.mockResolvedValue(null);
      creatorRepo.create.mockImplementation((p) => p as CreatorProfile);
      creatorRepo.save.mockImplementation(async (p) => ({
        ...(p as CreatorProfile),
        id: 'uuid-new',
      }));

      const result = await service.onboard(1, { handle: '  Jane_DOE  ' });

      expect(result.handle).toBe('jane_doe');
    });
  });

  describe('getByHandle', () => {
    it('returns the public dto without email/password or userId', async () => {
      creatorRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        userId: 7,
        handle: 'jane_doe',
        displayName: 'Jane',
        bio: 'Coach',
        bannerUrl: null,
        category: 'fitness',
        isOnboarded: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as CreatorProfile);

      const result = await service.getByHandle('jane_doe');

      expect(result).toEqual({
        handle: 'jane_doe',
        displayName: 'Jane',
        bio: 'Coach',
        bannerUrl: null,
        category: 'fitness',
        createdAt: expect.any(Date),
      });
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('id');
    });

    it('throws NotFound when no creator has the handle', async () => {
      creatorRepo.findOne.mockResolvedValue(null);

      await expect(service.getByHandle('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateOwnProfile', () => {
    it('updates owner-editable fields and returns the private dto', async () => {
      const profile = {
        id: 'uuid-1',
        userId: 1,
        handle: 'jane_doe',
        displayName: 'Jane',
        bio: 'old bio',
        bannerUrl: null,
        category: null,
        isOnboarded: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as CreatorProfile;
      creatorRepo.findOne.mockResolvedValue(profile);
      creatorRepo.save.mockImplementation(async (p) => p as CreatorProfile);

      const result = await service.updateOwnProfile(1, {
        bio: 'new bio',
        bannerUrl: 'https://cdn.myfans.dev/banner.jpg',
      });

      expect(result.bio).toBe('new bio');
      expect(result.bannerUrl).toBe('https://cdn.myfans.dev/banner.jpg');
      expect(result.handle).toBe('jane_doe');
    });

    it('throws NotFound when the caller has no creator profile', async () => {
      creatorRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateOwnProfile(1, { bio: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Forbidden (403) when the profile is owned by another user', async () => {
      // Defense-in-depth: the loaded profile belongs to user 2, not the caller.
      creatorRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        userId: 2,
        handle: 'jane_doe',
      } as CreatorProfile);

      await expect(
        service.updateOwnProfile(1, { bio: 'x' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(creatorRepo.save).not.toHaveBeenCalled();
    });
  });
});
