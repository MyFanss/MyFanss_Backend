import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription } from '../subscriptions/subscription.entity';
import { CreatorAnalyticsResponseDto } from './dtos/creator-analytics-response.dto';

@Injectable()
export class CreatorAnalyticsService {
  private readonly logger = new Logger(CreatorAnalyticsService.name);
  private readonly cacheTtl = 60;

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getCreatorAnalytics(
    creatorId: number,
    days: number,
  ): Promise<CreatorAnalyticsResponseDto> {
    const cacheKey = `creator-analytics:${creatorId}:${days}`;
    const cached = await this.cacheManager.get<CreatorAnalyticsResponseDto>(
      cacheKey,
    );
    if (cached) {
      this.logger.debug(
        `Cache hit for creator analytics creatorId=${creatorId} days=${days}`,
      );
      return cached;
    }

    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - days);

    const queryStart = Date.now();
    const [subscriberCountResult] = await this.subscriptionRepo
      .createQueryBuilder('subscription')
      .select('COUNT(DISTINCT subscription.subscriber_id)', 'count')
      .where('subscription.creator_id = :creatorId', { creatorId })
      .andWhere('subscription.status = :active', { active: 'active' })
      .getRawMany();

    const [newSubscriberResult] = await this.subscriptionRepo
      .createQueryBuilder('subscription')
      .select('COUNT(DISTINCT subscription.subscriber_id)', 'count')
      .where('subscription.creator_id = :creatorId', { creatorId })
      .andWhere('subscription.status = :active', { active: 'active' })
      .andWhere('subscription.created_at >= :startDate', { startDate })
      .getRawMany();

    const [churnedSubscriberResult] = await this.subscriptionRepo
      .createQueryBuilder('subscription')
      .select('COUNT(DISTINCT subscription.subscriber_id)', 'count')
      .where('subscription.creator_id = :creatorId', { creatorId })
      .andWhere('subscription.status = :cancelled', { cancelled: 'cancelled' })
      .andWhere('subscription.cancelled_at >= :startDate', { startDate })
      .getRawMany();

    const rawReferrers = await this.subscriptionRepo
      .createQueryBuilder('subscription')
      .select('subscription.referrer', 'referrer')
      .addSelect('COUNT(*)', 'count')
      .where('subscription.creator_id = :creatorId', { creatorId })
      .andWhere('subscription.status = :active', { active: 'active' })
      .andWhere('subscription.referrer IS NOT NULL')
      .groupBy('subscription.referrer')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    const subscriberCount = Number(subscriberCountResult?.count ?? 0);
    const newSubscribers = Number(newSubscriberResult?.count ?? 0);
    const churnedSubscribers = Number(churnedSubscriberResult?.count ?? 0);
    const topReferrers = rawReferrers.map((row) => ({
      referrer: row.referrer,
      count: Number(row.count),
    }));
    const response: CreatorAnalyticsResponseDto = {
      subscriberCount,
      newSubscribers,
      churnedSubscribers,
      periodDays: days,
      topReferrers,
    };

    const queryEnd = Date.now();
    this.logger.debug(
      `Computed creator analytics creatorId=${creatorId} days=${days} in ${
        queryEnd - queryStart
      }ms`,
    );

    await this.cacheManager.set(cacheKey, response, this.cacheTtl);

    return response;
  }
}
