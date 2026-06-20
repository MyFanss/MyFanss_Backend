import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../subscriptions/subscription.entity';
import { CreatorAnalyticsController } from './creator-analytics.controller';
import { CreatorAnalyticsService } from './creator-analytics.service';
import { CreatorRoleGuard } from './creator-role.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription])],
  providers: [CreatorAnalyticsService, CreatorRoleGuard],
  controllers: [CreatorAnalyticsController],
  exports: [CreatorAnalyticsService],
})
export class CreatorsModule {}
