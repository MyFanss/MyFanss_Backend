import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './subscription.entity';
import { User } from '../users/user.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { CreatorsController } from './creators.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, User])],
  providers: [SubscriptionsService],
  controllers: [SubscriptionsController, CreatorsController],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
