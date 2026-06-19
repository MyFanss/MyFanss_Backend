import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dtos/create-subscription.dto';
import { SubscriptionQueryDto } from './dtos/subscription-query.dto';
import { SubscriptionResponseDto } from './dtos/subscription-response.dto';
import { PaginatedResponseDto } from '../users/dtos/paginated-response.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
    username: string;
  };
}

@ApiTags('Subscriptions')
@ApiBearerAuth('JWT-auth')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @ApiOperation({ summary: 'Fan subscribes to a creator' })
  @ApiResponse({
    status: 201,
    description: 'Subscription created (or reactivated after a prior cancel)',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cannot subscribe to yourself' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  @ApiResponse({
    status: 409,
    description: 'Active subscription to this creator already exists',
  })
  async subscribe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.subscribe(req.user.userId, dto);
  }

  @Delete(':creatorId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Fan cancels a subscription to a creator' })
  @ApiParam({ name: 'creatorId', description: 'Creator ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'No active subscription to this creator',
  })
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('creatorId', ParseIntPipe) creatorId: number,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.cancel(req.user.userId, creatorId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Fan lists their own active subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of active subscriptions',
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listMySubscriptions(
    @Req() req: AuthenticatedRequest,
    @Query() query: SubscriptionQueryDto,
  ): Promise<PaginatedResponseDto<SubscriptionResponseDto>> {
    return this.subscriptionsService.listMySubscriptions(
      req.user.userId,
      query,
    );
  }
}
