import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { User } from './user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { UsersQueryService } from './services/users-query.service';
import { SearchService } from './services/search.service';
import { PermissionService } from './services/permission.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken]),
    CacheModule.register(),
    NotificationsModule,
  ],
  providers: [
    UsersService,
    UsersQueryService,
    SearchService,
    PermissionService,
  ],
  controllers: [UsersController],
  exports: [UsersService, UsersQueryService, SearchService, PermissionService],
})
export class UsersModule {}
