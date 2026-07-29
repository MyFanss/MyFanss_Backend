import {
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BillingWebhooksService } from './billing-webhooks.service';
import { ExemptTier } from '../common/throttle/tiers.decorator';

@ApiTags('Billing Webhooks')
@Controller('api/v1/webhooks')
export class BillingWebhooksController {
  constructor(
    private readonly billingWebhooksService: BillingWebhooksService,
  ) {}

  // Rate limiting is skipped here (provider retries must not be blocked by
  // the global authenticated-user limiter) — signature verification is the
  // real gate on this route.
  @Post('billing')
  @ExemptTier()
  @HttpCode(200)
  @ApiOperation({ summary: 'Inbound billing provider webhook (Stripe-style)' })
  @ApiResponse({
    status: 200,
    description: 'Event accepted (processed, ignored, or duplicate no-op)',
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing signature' })
  @ApiResponse({ status: 413, description: 'Payload too large' })
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.billingWebhooksService.handleIncoming(req.rawBody, signature);
  }
}
