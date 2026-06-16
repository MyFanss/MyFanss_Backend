import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { RateLimitService } from './services/rate-limit.service';

@Module({
  imports: [CacheModule.register()],
  providers: [RateLimitService],
  exports: [RateLimitService, CacheModule],
})
export class CommonModule {}
