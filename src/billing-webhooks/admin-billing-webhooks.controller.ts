import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/role.enum';
import { BillingWebhooksService } from './billing-webhooks.service';
import { QueryWebhookEventsDto } from './dtos/query-webhook-events.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../users/dtos/paginated-response.dto';
import { AdminWebhookEventResponseDto } from './dtos/webhook-event-response.dto';

@ApiTags('Admin - Billing Webhooks')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1/admin/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminBillingWebhooksController {
  constructor(
    private readonly billingWebhooksService: BillingWebhooksService,
  ) {}

  @Get('webhook-events')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List billing webhook events (admin only, read-only)',
  })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Paginated billing webhook events' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  async listEvents(
    @Query() query: QueryWebhookEventsDto,
  ): Promise<PaginatedResponseDto<AdminWebhookEventResponseDto>> {
    const { data, total, page, limit } =
      await this.billingWebhooksService.listEvents(query);

    const pagination: PaginationMetaDto = {
      hasMore: page * limit < total,
      totalCount: total,
      limit,
    };

    return {
      data: data.map((event) => ({
        id: event.id,
        eventId: event.eventId,
        type: event.type,
        status: event.status,
        error: event.error,
        payload: event.payload,
        signaturePresent: event.signaturePresent,
        processingLatencyMs: event.processingLatencyMs,
        deliveryAttempts: event.deliveryAttempts,
        receivedAt: event.receivedAt,
        processedAt: event.processedAt,
      })),
      pagination,
    };
  }
}
