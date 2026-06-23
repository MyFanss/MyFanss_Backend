import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../subscriptions/subscription.entity';
import { CreatorProfile } from './creator-profile.entity';
import { User } from '../users/user.entity';
import { CreatorsService } from './creators.service';
import { CreatorsController } from './creators.controller';
import { CreatorAnalyticsController } from './creator-analytics.controller';
import { CreatorAnalyticsService } from './creator-analytics.service';
import { CreatorRoleGuard } from './creator-role.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, CreatorProfile, User])],
  providers: [CreatorsService, CreatorAnalyticsService, CreatorRoleGuard],
  controllers: [CreatorsController, CreatorAnalyticsController],
  exports: [CreatorsService, CreatorAnalyticsService],
})
export class CreatorsModule {}
