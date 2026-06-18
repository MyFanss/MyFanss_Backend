import {
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './dtos/createUser.dto';
import { UserResponseDto } from './dtos/userResponse.dto';
import { plainToInstance } from 'class-transformer';
import { UpdateUserDto } from './dtos/updateUser.dto';
import { UpdateProfileDto } from './dtos/updateProfile.dto';
import { GetUsersQueryDto } from './dtos/get-users-query.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from './dtos/paginated-response.dto';
import { UsersQueryService } from './services/users-query.service';
import { SearchService } from './services/search.service';
import { PermissionService, JwtPayload } from './services/permission.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly queryService: UsersQueryService,
    private readonly searchService: SearchService,
    private readonly permissionService: PermissionService,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async getAllUsers(
    query: GetUsersQueryDto,
    requestingUser?: JwtPayload,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    // Validate query parameters
    this.queryService.validateQueryParams(query);

    // Get permission-based org filter
    const orgFilter = requestingUser
      ? this.permissionService.getAccessibleOrgIds(requestingUser)
      : undefined;

    // Execute query with pagination, filtering, and sorting
    const result = await this.queryService.getUsers(query, orgFilter);

    // Apply row-level permission filtering
    const filteredUsers = requestingUser
      ? this.permissionService.filterByPermission(result.users, requestingUser)
      : result.users;

    // Transform to response DTOs
    const responseUsers = filteredUsers.map((user) =>
      plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues: true,
      }),
    );

    // Build pagination metadata
    const paginationMeta: PaginationMetaDto = {
      cursor: result.nextCursor,
      hasMore: result.hasMore,
      totalCount: result.totalCount,
      limit: query.limit || 20,
      appliedFilters: this.getAppliedFilters(query),
    };

    return {
      data: responseUsers,
      pagination: paginationMeta,
    };
  }

  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    console.log('createUserDto', createUserDto);
    let searchUser: User | null = await this.getUserByEmail(
      createUserDto.email,
    );

    if (searchUser) {
      throw new ConflictException('user already exists with this email');
    }

    // Hash the password before saving
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      saltRounds,
    );

    let user: User = plainToInstance(User, {
      ...createUserDto,
      password: hashedPassword,
    });
    let savedUser: User = await this.userRepository.save(user);

    // Update search text and invalidate caches
    await this.searchService.updateSearchTextForUser(savedUser.id);
    await this.invalidateUserRelatedCaches(savedUser.id);

    return plainToInstance(
      UserResponseDto,
      { message: 'user created successfully...', ...savedUser },
      {
        excludeExtraneousValues: true,
      },
    );
  }

  private getUserByEmail(email: string) {
    return this.userRepository.findOneBy({ email });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOneBy({ email });
  }

  private findById(id: number) {
    return this.userRepository.findOneBy({ id });
  }

  async getUserById(id: number): Promise<UserResponseDto> {
    let user: User | null = await this.findById(id);
    if (!user) {
      throw new NotFoundException('user not found');
    }
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  async deleteUser(id: number): Promise<string> {
    let user: User | null = await this.findById(id);
    if (!user) {
      throw new NotFoundException('user not found');
    }

    // Soft delete
    await this.userRepository.update(id, { is_deleted: true });
    await this.invalidateUserRelatedCaches(id);

    return 'user deleted successfully...';
  }

  async updateUser(
    id: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    let user: User | null = await this.findById(id);
    if (!user) {
      throw new NotFoundException('user not found');
    }

    Object.assign(user, updateUserDto);
    let savedUser: User = await this.userRepository.save(user);

    // Update search text and invalidate caches
    await this.searchService.updateSearchTextForUser(savedUser.id);
    await this.invalidateUserRelatedCaches(savedUser.id);

    return plainToInstance(
      UserResponseDto,
      { message: 'user updated successfully', ...savedUser },
      {
        excludeExtraneousValues: true,
      },
    );
  }

  async updateProfile(
    id: number,
    updateProfileDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const user: User | null = await this.findById(id);
    if (!user) {
      throw new NotFoundException('user not found');
    }

    Object.assign(user, updateProfileDto);
    const savedUser: User = await this.userRepository.save(user);

    await this.invalidateUserRelatedCaches(savedUser.id);

    return plainToInstance(UserResponseDto, savedUser, {
      excludeExtraneousValues: true,
    });
  }

  private async invalidateUserRelatedCaches(userId: number): Promise<void> {
    await this.cacheManager.del('users:totalCount');
    await this.cacheManager.del(`users:permissions:${userId}`);
    await this.cacheManager.del('users:search:*');
  }

  private getAppliedFilters(query: GetUsersQueryDto): Record<string, unknown> {
    const filters: Record<string, unknown> = {};

    if (query.search) filters.search = query.search;
    if (query.role) filters.role = query.role;
    if (query.status) filters.status = query.status;
    if (query.org_id) filters.org_id = query.org_id;
    if (query.created_from) filters.created_from = query.created_from;
    if (query.created_to) filters.created_to = query.created_to;

    return filters;
  }
}
