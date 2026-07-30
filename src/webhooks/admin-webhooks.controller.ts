import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/role.enum';
import { WebhooksService } from './webhooks.service';
import { QueryWebhookEventsDto } from './dtos/query-webhook-events.dto';
import { WebhookEventResponseDto } from './dtos/webhook-event-response.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../users/dtos/paginated-response.dto';

@ApiTags('Admin - Webhook Events')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1/admin/webhook-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminWebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'List outbound webhook events (admin only)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Paginated webhook events' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  async listEvents(
    @Query() query: QueryWebhookEventsDto,
  ): Promise<PaginatedResponseDto<WebhookEventResponseDto>> {
    const { data, total, page, limit } =
      await this.webhooksService.listEvents(query);

    const pagination: PaginationMetaDto = {
      hasMore: page * limit < total,
      totalCount: total,
      limit,
    };

    return {
      data: data.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        payload: event.payload,
        status: event.status,
        attempts: event.attempts,
        nextAttemptAt: event.nextAttemptAt,
        lastError: event.lastError,
        createdAt: event.createdAt,
        deliveredAt: event.deliveredAt,
      })),
      pagination,
    };
  }

  @Post('dispatch')
  @ApiOperation({
    summary:
      'Process due pending webhook events now (admin/test trigger — there ' +
      'is no in-process cron in this stub)',
  })
  @ApiResponse({ status: 200, description: 'Dispatch outcome counts' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  async dispatch() {
    return this.webhooksService.dispatch();
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Reset a dead webhook event back to pending' })
  @ApiParam({ name: 'id', description: 'Webhook event ID' })
  @ApiResponse({ status: 200, description: 'Event reset to pending' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Webhook event not found' })
  @ApiResponse({ status: 409, description: 'Only dead events can be retried' })
  async retry(@Param('id') id: string): Promise<WebhookEventResponseDto> {
    const event = await this.webhooksService.retry(id);
    return {
      id: event.id,
      eventType: event.eventType,
      payload: event.payload,
      status: event.status,
      attempts: event.attempts,
      nextAttemptAt: event.nextAttemptAt,
      lastError: event.lastError,
      createdAt: event.createdAt,
      deliveredAt: event.deliveredAt,
    };
  }
}
