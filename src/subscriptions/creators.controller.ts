import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionQueryDto } from './dtos/subscription-query.dto';
import { SubscriberResponseDto } from './dtos/subscriber-response.dto';
import { PaginatedResponseDto } from '../users/dtos/paginated-response.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
    username: string;
  };
}

@ApiTags('Creators')
@ApiBearerAuth('JWT-auth')
@Controller('creators')
@UseGuards(JwtAuthGuard)
export class CreatorsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me/subscribers')
  @ApiOperation({
    summary: 'Creator lists their own subscribers (subscriber count + fan IDs)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Paginated list of active subscribers. `pagination.totalCount` is the subscriber count.',
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listMySubscribers(
    @Req() req: AuthenticatedRequest,
    @Query() query: SubscriptionQueryDto,
  ): Promise<PaginatedResponseDto<SubscriberResponseDto>> {
    return this.subscriptionsService.listMySubscribers(req.user.userId, query);
  }
}
