import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dtos/create-post.dto';
import { UpdatePostDto } from './dtos/update-post.dto';
import { PaginationQueryDto } from './dtos/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

interface AuthenticatedRequestUser {
  userId: number;
  email: string;
  username: string;
}

interface AuthenticatedRequest extends Request {
  user: AuthenticatedRequestUser;
}

interface OptionallyAuthenticatedRequest extends Request {
  user?: AuthenticatedRequestUser;
}

@ApiTags('Posts')
@Controller('creators')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('me/posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new post as authenticated creator' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPost(
    @Body() dto: CreatePostDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.postsService.createPost(req.user.userId, dto);
  }

  @Get('me/posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all posts by authenticated creator (paginated)',
  })
  @ApiResponse({ status: 200, description: 'Posts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  async getMyPosts(
    @Query() query: PaginationQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.postsService.getCreatorPosts(
      req.user.userId,
      query.page,
      query.limit,
    );
  }

  @Get('me/posts/archived')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get soft-deleted posts by authenticated creator (paginated)',
  })
  @ApiResponse({
    status: 200,
    description: 'Archived posts retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  async getArchivedPosts(
    @Query() query: PaginationQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.postsService.getArchivedPosts(
      req.user.userId,
      query.page,
      query.limit,
    );
  }

  @Get(':handle/posts')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Get posts by creator handle (paginated). Auth is optional: anonymous ' +
      'callers and non-subscribers see only public posts; the owner or an ' +
      'active subscriber additionally see subscriber-only posts.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Posts retrieved successfully. Content included depends on the ' +
      'caller: anonymous/non-subscriber -> public only; owner/active ' +
      'subscriber -> public + subscribers.',
  })
  @ApiResponse({
    status: 404,
    description: 'No creator exists for this handle',
  })
  @ApiParam({
    name: 'handle',
    description: 'Public creator handle (string, e.g. "creator_one")',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  async getCreatorPostsByHandle(
    @Param('handle') handle: string,
    @Query() query: PaginationQueryDto,
    @Req() req: OptionallyAuthenticatedRequest,
  ) {
    const viewer = req.user ? { userId: req.user.userId } : undefined;
    return this.postsService.getPostsByHandle(
      handle,
      viewer,
      query.page,
      query.limit,
    );
  }

  @Get(':handle/posts/:postId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Get a single post by creator handle and post id, with the same ' +
      'visibility rules as the list endpoint',
  })
  @ApiResponse({ status: 200, description: 'Post retrieved successfully' })
  @ApiResponse({
    status: 404,
    description:
      'Creator not found, post not found, or post exists but is not ' +
      'visible to this caller (unauthorized subscriber/owner-only content ' +
      'is reported as 404, not 403, to avoid leaking its existence)',
  })
  @ApiParam({
    name: 'handle',
    description: 'Public creator handle (string, e.g. "creator_one")',
  })
  @ApiParam({ name: 'postId', description: 'Post ID' })
  async getCreatorPostByHandle(
    @Param('handle') handle: string,
    @Param('postId', ParseIntPipe) postId: number,
    @Req() req: OptionallyAuthenticatedRequest,
  ) {
    const viewer = req.user ? { userId: req.user.userId } : undefined;
    return this.postsService.getPostByHandle(handle, postId, viewer);
  }

  @Patch('me/posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update an existing post' })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: "Cannot edit another creator's post",
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  async updatePost(
    @Param('id', ParseIntPipe) postId: number,
    @Body() dto: UpdatePostDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.postsService.updatePost(postId, req.user.userId, dto);
  }

  @Delete('me/posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Soft-delete a post (moves it to the archive, idempotent)',
  })
  @ApiResponse({
    status: 204,
    description: 'Post soft-deleted (or already deleted)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: "Cannot delete another creator's post",
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  async deletePost(
    @Param('id', ParseIntPipe) postId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.postsService.deletePost(postId, req.user.userId);
  }

  @Post('me/posts/:id/restore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore a soft-deleted post' })
  @ApiResponse({ status: 200, description: 'Post restored successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: "Cannot restore another creator's post",
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 409, description: 'Post is not deleted' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  async restorePost(
    @Param('id', ParseIntPipe) postId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.postsService.restorePost(postId, req.user.userId);
  }
}
