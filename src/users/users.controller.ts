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
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dtos/createUser.dto';
import { UpdateProfileDto } from './dtos/updateProfile.dto';
import { UserResponseDto } from './dtos/userResponse.dto';
import { GetUsersQueryDto } from './dtos/get-users-query.dto';
import { PaginatedResponseDto } from './dtos/paginated-response.dto';
import { UpdateUserDto } from './dtos/updateUser.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../audit/admin.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

import { Request } from 'express';

interface CurrentUser {
  id: number;
  email: string;
  role: string;
  orgId?: number;
}

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
    username: string;
  };
}

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully created',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'User already exists with this email',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
      - 'role': admin, manager, user (comma-separated)
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
    description: 'Filter by roles (comma-separated: admin, manager, user)',
    type: String,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description:
      'Filter by status (comma-separated: active, inactive, suspended)',
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
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    // Extract user from request (would come from JWT in real implementation)
    const currentUser: CurrentUser | undefined = {
      id: 1,
      email: 'admin@example.com',
      role: 'admin',
      orgId: 1,
    };

    return this.usersService.getAllUsers(query, currentUser);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Delete user by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deleteUser(
    @Param('id') id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<string> {
    return this.usersService.deleteUser(id, req.user.userId);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Change user role (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({
    schema: { type: 'object', properties: { role: { type: 'string' } } },
  })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async changeUserRole(
    @Param('id') id: number,
    @Body('role') role: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.usersService.changeUserRole(id, role, req.user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateUser(
    @Param('id') id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Patch(':id/profile')
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
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @Param('id') id: number,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(id, updateProfileDto);
  }
}
