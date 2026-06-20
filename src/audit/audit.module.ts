import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit.entity';
import { User } from '../users/user.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, User])],
  controllers: [AuditController],
  providers: [AuditService, AdminGuard],
  exports: [AuditService, AdminGuard],
})
export class AuditModule {}
