import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminWebhookEventsController } from './admin-webhook-events.controller';
import { UsersModule } from '../users/users.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [UsersModule, WebhooksModule],
  controllers: [AdminUsersController, AdminWebhookEventsController],
})
export class AdminModule {}
