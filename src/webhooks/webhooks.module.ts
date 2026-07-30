import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from './webhook-event.entity';
import { WebhooksService } from './webhooks.service';
import { AdminWebhooksController } from './admin-webhooks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEvent])],
  controllers: [AdminWebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
