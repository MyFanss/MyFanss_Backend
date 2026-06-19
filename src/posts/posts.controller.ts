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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
    username: string;
  };
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
  @ApiOperation({ summary: 'Get all posts by authenticated creator (paginated)' })
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

  @Get(':handle/posts')
  @ApiOperation({
    summary:
      'Get public posts by creator (paginated, visibility-aware for subscribers)',
  })
  @ApiResponse({ status: 200, description: 'Posts retrieved successfully' })
  @ApiParam({ name: 'handle', description: 'Creator handle/identifier' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  async getCreatorPostsByHandle(
    @Param('handle', ParseIntPipe) creatorId: number,
    @Query() query: PaginationQueryDto,
    @Req() req?: Request,
  ) {
    // For now, treat unauthenticated users as non-subscribers
    const isSubscriber = false;
    return this.postsService.getPublicCreatorPosts(
      creatorId,
      isSubscriber,
      query.page,
      query.limit,
    );
  }

  @Patch('me/posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update an existing post' })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Cannot edit another creator\'s post' })
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
  @ApiOperation({ summary: 'Delete a post' })
  @ApiResponse({ status: 204, description: 'Post deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Cannot delete another creator\'s post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  async deletePost(
    @Param('id', ParseIntPipe) postId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.postsService.deletePost(postId, req.user.userId);
  }
}
