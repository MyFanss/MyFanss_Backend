import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { CreatorsModule } from './creators/creators.module';
import { PostsModule } from './posts/posts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { dataOption } from './migrations/appDataSource.db';
import { LoggerModule } from './logger/logger.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { HealthModule } from './monitoring/health.module';
import { ThrottleConfigModule } from './common/throttle/throttle.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({
      isGlobal: true,
      ttl: 60000, // 60 seconds default TTL
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...dataOption(configService),
      }),
      inject: [ConfigService],
    }),
    ThrottleConfigModule,
    UsersModule,
    LoggerModule,
    MonitoringModule,
    HealthModule,
    AuthModule,
    SubscriptionsModule,
    CreatorsModule,
    PostsModule,
    NotificationsModule,
    AuditModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
