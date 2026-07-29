import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingWebhookEvent } from './billing-webhook-event.entity';
import { BillingCustomerMap } from './billing-customer-map.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { BillingWebhooksService } from './billing-webhooks.service';
import { BillingWebhooksController } from './billing-webhooks.controller';
import { AdminBillingWebhooksController } from './admin-billing-webhooks.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BillingWebhookEvent,
      BillingCustomerMap,
      Subscription,
    ]),
    AuditModule,
  ],
  controllers: [BillingWebhooksController, AdminBillingWebhooksController],
  providers: [BillingWebhooksService],
  exports: [BillingWebhooksService],
})
export class BillingWebhooksModule {}
