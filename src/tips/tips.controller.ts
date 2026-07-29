import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TipsService } from './tips.service';
import { CreateTipIntentDto } from './dto/create-tip-intent.dto';
import { ConfirmTipDto } from './dto/confirm-tip.dto';
import { TipQueryDto } from './dto/tip-query.dto';
import { TipResponseDto } from './dto/tip-response.dto';
import { PaginatedResponseDto } from '../users/dtos/paginated-response.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
    username: string;
  };
}

@ApiTags('Tips')
@ApiBearerAuth('JWT-auth')
@Controller('tips')
@UseGuards(JwtAuthGuard)
export class TipsController {
  constructor(private readonly tipsService: TipsService) {}

  @Post('intents')
  @ApiOperation({ summary: 'Create a pending tip intent (server fee quote)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Replays with the same key return the original tip',
  })
  @ApiResponse({
    status: 201,
    description: 'Pending tip intent created (or replayed)',
    type: TipResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Self-tip or amount out of bounds' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  @ApiResponse({
    status: 409,
    description: 'Idempotency key already used by another fan',
  })
  async createIntent(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTipIntentDto,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
  ): Promise<TipResponseDto> {
    return this.tipsService.createIntent(
      req.user.userId,
      dto,
      idempotencyKeyHeader,
    );
  }

  @Post('intents/:id/confirm')
  @ApiOperation({ summary: 'Confirm a pending tip intent (stub completion)' })
  @ApiParam({ name: 'id', description: 'Tip intent id' })
  @ApiResponse({
    status: 201,
    description: 'Tip completed (or already completed — idempotent)',
    type: TipResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Tip not found' })
  @ApiResponse({ status: 409, description: 'Tip already failed or cancelled' })
  async confirm(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmTipDto,
  ): Promise<TipResponseDto> {
    return this.tipsService.confirm(id, req.user.userId, dto);
  }

  @Post()
  @ApiOperation({
    summary: 'Create + confirm a tip in one call (same idempotency/fee rules)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Replays with the same key return the original tip',
  })
  @ApiResponse({
    status: 201,
    description: 'Tip created and completed (or replayed)',
    type: TipResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Self-tip or amount out of bounds' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  async createShorthand(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTipIntentDto,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
  ): Promise<TipResponseDto> {
    return this.tipsService.createShorthand(
      req.user.userId,
      dto,
      idempotencyKeyHeader,
    );
  }

  @Get('me')
  @ApiOperation({ summary: "Fan's own tip history" })
  @ApiResponse({
    status: 200,
    description: 'Paginated tip history',
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listMyTips(
    @Req() req: AuthenticatedRequest,
    @Query() query: TipQueryDto,
  ): Promise<PaginatedResponseDto<TipResponseDto>> {
    return this.tipsService.listFanHistory(req.user.userId, query);
  }
}
