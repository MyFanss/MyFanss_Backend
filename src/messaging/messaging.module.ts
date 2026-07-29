import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { MessageRateLimitGuard } from './guards/message-rate-limit.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, User])],
  providers: [MessagingService, MessageRateLimitGuard],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}
