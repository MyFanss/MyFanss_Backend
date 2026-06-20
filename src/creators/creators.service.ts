import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatorProfile } from './creator-profile.entity';
import { User } from '../users/user.entity';
import { OnboardCreatorDto, HANDLE_REGEX } from './dtos/onboard-creator.dto';
import { UpdateCreatorDto } from './dtos/update-creator.dto';
import { CreatorResponseDto } from './dtos/creator-response.dto';
import { CreatorPrivateDto } from './dtos/creator-private.dto';

@Injectable()
export class CreatorsService {
  constructor(
    @InjectRepository(CreatorProfile)
    private readonly creatorRepository: Repository<CreatorProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * An authenticated user onboards as a creator: validates the handle, ensures
   * the user has not already onboarded, ensures the handle is free, persists the
   * profile and upgrades the user's role to `creator`.
   */
  async onboard(
    userId: number,
    dto: OnboardCreatorDto,
  ): Promise<CreatorPrivateDto> {
    const handle = this.normalizeHandle(dto.handle);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingForUser = await this.creatorRepository.findOne({
      where: { userId },
    });
    if (existingForUser) {
      throw new ConflictException('User has already onboarded as a creator');
    }

    const handleTaken = await this.creatorRepository.findOne({
      where: { handle },
    });
    if (handleTaken) {
      throw new ConflictException(`Handle "${handle}" is already taken`);
    }

    const profile = this.creatorRepository.create({
      userId,
      handle,
      displayName: dto.displayName ?? null,
      bio: dto.bio ?? null,
      bannerUrl: dto.bannerUrl ?? null,
      category: dto.category ?? null,
      isOnboarded: true,
    });
    const saved = await this.creatorRepository.save(profile);

    // RBAC role upgrade: a fan account becomes a creator account.
    if (user.role !== 'creator') {
      user.role = 'creator';
      await this.userRepository.save(user);
    }

    return this.toPrivate(saved);
  }

  /**
   * Public profile lookup by handle. Never exposes email/password or internal
   * identifiers.
   */
  async getByHandle(handle: string): Promise<CreatorResponseDto> {
    const profile = await this.creatorRepository.findOne({
      where: { handle: this.normalizeHandle(handle) },
    });
    if (!profile) {
      throw new NotFoundException('Creator not found');
    }
    return this.toPublic(profile);
  }

  /**
   * Owner updates their own profile. Ownership is enforced both by looking the
   * profile up via the authenticated user id and by an explicit assertion, so a
   * non-owner can never mutate another creator's profile (403).
   */
  async updateOwnProfile(
    userId: number,
    dto: UpdateCreatorDto,
  ): Promise<CreatorPrivateDto> {
    const profile = await this.creatorRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('You have not onboarded as a creator');
    }

    this.assertOwnership(profile, userId);

    if (dto.displayName !== undefined) profile.displayName = dto.displayName;
    if (dto.bio !== undefined) profile.bio = dto.bio;
    if (dto.bannerUrl !== undefined) profile.bannerUrl = dto.bannerUrl;
    if (dto.category !== undefined) profile.category = dto.category;

    const saved = await this.creatorRepository.save(profile);
    return this.toPrivate(saved);
  }

  private assertOwnership(profile: CreatorProfile, userId: number): void {
    if (profile.userId !== userId) {
      throw new ForbiddenException('You do not own this creator profile');
    }
  }

  private normalizeHandle(handle: string): string {
    const normalized = (handle ?? '').trim().toLowerCase();
    if (!HANDLE_REGEX.test(normalized)) {
      throw new BadRequestException(
        'handle must match ^[a-z0-9_]{3,30}$ (lowercase letters, digits, underscores, 3-30 chars)',
      );
    }
    return normalized;
  }

  private toPublic(profile: CreatorProfile): CreatorResponseDto {
    return {
      handle: profile.handle,
      displayName: profile.displayName,
      bio: profile.bio,
      bannerUrl: profile.bannerUrl,
      category: profile.category,
      createdAt: profile.createdAt,
    };
  }

  private toPrivate(profile: CreatorProfile): CreatorPrivateDto {
    return {
      ...this.toPublic(profile),
      id: profile.id,
      userId: profile.userId,
      isOnboarded: profile.isOnboarded,
      updatedAt: profile.updatedAt,
    };
  }
}
