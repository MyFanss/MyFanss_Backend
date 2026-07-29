import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { CreateConversationDto } from './dtos/create-conversation.dto';
import { SendMessageDto } from './dtos/send-message.dto';
import { MarkReadDto } from './dtos/mark-read.dto';
import { CursorPaginationDto } from './dtos/cursor-pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/role.enum';
import { MessageRateLimitGuard } from './guards/message-rate-limit.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
    username: string;
    role: string;
  };
}

@ApiTags('Messaging')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.FAN)
  @ApiOperation({
    summary:
      'Start (or resume) a conversation with a creator. Fans only — creators reply to fan-initiated threads.',
  })
  @ApiResponse({ status: 200, description: 'Existing conversation returned' })
  @ApiResponse({ status: 201, description: 'New conversation created' })
  @ApiResponse({
    status: 400,
    description: 'Invalid or self-targeted creatorId',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Only fans may start conversations',
  })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  async createConversation(
    @Body() dto: CreateConversationDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { conversation, created } =
      await this.messagingService.getOrCreateConversation(req.user.userId, dto);
    res.status(created ? 201 : 200);
    return conversation;
  }

  @Get('me')
  @ApiOperation({
    summary: 'List the current user’s conversations (inbox), newest first',
  })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Inbox retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listInbox(
    @Query() query: CursorPaginationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messagingService.listInbox(req.user.userId, query);
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'List messages in a conversation, oldest to newest',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Not a participant in this conversation',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async listMessages(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: CursorPaginationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messagingService.listMessages(id, req.user.userId, query);
  }

  @Post(':id/messages')
  @UseGuards(MessageRateLimitGuard)
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Send a message in a conversation. Supports an optional clientId (or Idempotency-Key header) for idempotent retries.',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or empty body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Not a participant, or recipient unavailable',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async sendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const idempotencyKey = req.header('Idempotency-Key');
    if (idempotencyKey && !dto.clientId) {
      dto.clientId = idempotencyKey;
    }
    return this.messagingService.sendMessage(id, req.user.userId, dto);
  }

  @Post(':id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark messages from the other participant as read' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Not a participant in this conversation',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async markRead(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkReadDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messagingService.markRead(id, req.user.userId, dto);
  }
}
