import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExtendedThrottlerGuard } from './extended-throttler-guard';
import { buildThrottlerModuleOptions } from './throttle.config';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ThrottlerModuleOptions => {
        return buildThrottlerModuleOptions(configService);
      },
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ExtendedThrottlerGuard,
    },
    makeCounterProvider({
      name: 'http_rate_limit_exceeded_total',
      help: 'Total number of HTTP requests that exceeded the rate limit',
      labelNames: ['tier'],
    }),
  ],
})
export class ThrottleConfigModule {}
