import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  Query,
  Header,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dtos/createUser.dto';
import { UpdateProfileDto } from './dtos/updateProfile.dto';
import { UserResponseDto } from './dtos/userResponse.dto';
import { GetUsersQueryDto } from './dtos/get-users-query.dto';
import { PaginatedResponseDto } from './dtos/paginated-response.dto';
import { UpdateUserDto } from './dtos/updateUser.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'User successfully created',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'User already exists with this email',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async createUser(
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.createUser(createUserDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getUser(@Param('id') id: number): Promise<UserResponseDto> {
    return this.usersService.getUserById(id);
  }

  @Get()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get paginated list of users with filtering and search',
    description: `
      Advanced pagination with cursor-based keyset pagination, multi-field filtering, and full-text search.

      Pagination:
      - Use 'cursor' for keyset pagination (more stable with concurrent inserts)
      - Use 'limit' (1-100, default 20) for page size
      - Response includes next 'cursor' for pagination

      Filtering:
      - 'role': fan, creator, admin (comma-separated)
      - 'status': active, inactive, suspended (comma-separated)
      - 'org_id': organization IDs (comma-separated)
      - 'created_from', 'created_to': ISO date strings

      Search:
      - 'search': full-text search on name and email

      Sorting:
      - 'sort_by': name, email, created_at, role, status, relevance
      - 'sort_order': ASC or DESC

      Legacy (deprecated):
      - 'page' and 'page_size' for offset-based pagination (will be sunset 2026-12-31)
    `,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor for pagination (base64 encoded)',
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Page size (1-100, default 20)',
    type: Number,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Full-text search term (searches name and email)',
    type: String,
  })
  @ApiQuery({
    name: 'role',
    required: false,
    description: 'Filter by role (fan, creator, admin)',
    type: String,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (active, inactive, suspended)',
    type: String,
  })
  @ApiQuery({
    name: 'org_id',
    required: false,
    description: 'Filter by organization IDs (comma-separated)',
    type: String,
  })
  @ApiQuery({
    name: 'created_from',
    required: false,
    description: 'Created date range start (ISO 8601)',
    type: String,
  })
  @ApiQuery({
    name: 'created_to',
    required: false,
    description: 'Created date range end (ISO 8601)',
    type: String,
  })
  @ApiQuery({
    name: 'sort_by',
    required: false,
    description: 'Sort field (created_at, name, email, role, status)',
    type: String,
  })
  @ApiQuery({
    name: 'sort_order',
    required: false,
    description: 'Sort order (ASC or DESC)',
    type: String,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'DEPRECATED: Use cursor instead. Offset-based page number',
    type: Number,
  })
  @ApiQuery({
    name: 'page_size',
    required: false,
    description:
      'DEPRECATED: Use limit instead. Page size for offset pagination',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of users with filters applied',
    type: PaginatedResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  @Header('X-Total-Count', 'true')
  @Header('X-Has-Next-Page', 'true')
  async getAllUsers(
    @Query() query: GetUsersQueryDto,
    @CurrentUser()
    currentUser?: { id: number; email: string; role: string; orgId?: number },
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    return this.usersService.getAllUsers(query, currentUser);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete user by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async deleteUser(@Param('id') id: number): Promise<string> {
    return this.usersService.deleteUser(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async updateUser(
    @Param('id') id: number,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser?: { id: number; email: string; role: string },
  ): Promise<UserResponseDto> {
    const isOwner = currentUser && currentUser.id === id;
    const isAdmin = currentUser && currentUser.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        message: 'You can only update your own profile',
        code: 'INSUFFICIENT_ROLE',
      });
    }

    const { role: _role, ...safeUpdate } = updateUserDto as Record<
      string,
      unknown
    >;
    return this.usersService.updateUser(id, safeUpdate as UpdateUserDto);
  }

  @Patch(':id/profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Partially update user profile fields' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. bio too long, invalid URL)',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async updateProfile(
    @Param('id') id: number,
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() currentUser?: { id: number; email: string; role: string },
  ): Promise<UserResponseDto> {
    const isOwner = currentUser && currentUser.id === id;
    const isAdmin = currentUser && currentUser.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        message: 'You can only update your own profile',
        code: 'INSUFFICIENT_ROLE',
      });
    }

    return this.usersService.updateProfile(id, updateProfileDto);
  }
}
