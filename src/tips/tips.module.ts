import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tip } from './tip.entity';
import { User } from '../users/user.entity';
import { TipsService } from './tips.service';
import { TipsController } from './tips.controller';
import { CreatorTipsController } from './creator-tips.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tip, User]), AuditModule],
  providers: [TipsService],
  controllers: [TipsController, CreatorTipsController],
  exports: [TipsService],
})
export class TipsModule {}
