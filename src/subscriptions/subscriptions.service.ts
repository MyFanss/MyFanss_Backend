import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './subscription.entity';
import { User } from '../users/user.entity';
import { CreateSubscriptionDto } from './dtos/create-subscription.dto';
import { SubscriptionQueryDto } from './dtos/subscription-query.dto';
import { SubscriptionResponseDto } from './dtos/subscription-response.dto';
import { SubscriberResponseDto } from './dtos/subscriber-response.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../users/dtos/paginated-response.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Fan subscribes to a creator.
   *
   * Idempotency / re-subscribe choice: we keep a single row per fan+creator
   * pair. A brand-new subscription inserts a row; re-subscribing after a cancel
   * reactivates that same row (status -> active, cancelledAt cleared,
   * subscribedAt refreshed) rather than inserting a duplicate. Attempting to
   * subscribe while an active subscription already exists returns 409.
   */
  async subscribe(
    fanId: number,
    dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const { creatorId } = dto;

    if (creatorId === fanId) {
      throw new BadRequestException('A fan cannot subscribe to themselves');
    }

    const creator = await this.userRepository.findOne({
      where: { id: creatorId },
    });
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const existing = await this.subscriptionRepository.findOne({
      where: { fanId, creatorId },
    });

    if (existing) {
      if (existing.status === 'active') {
        throw new ConflictException(
          'An active subscription to this creator already exists',
        );
      }

      // Reactivate the previously cancelled subscription.
      existing.status = 'active';
      existing.cancelledAt = null;
      existing.subscribedAt = new Date();
      const reactivated = await this.subscriptionRepository.save(existing);
      return this.toResponse(reactivated);
    }

    const subscription = this.subscriptionRepository.create({
      fanId,
      creatorId,
      status: 'active',
      cancelledAt: null,
    });
    const saved = await this.subscriptionRepository.save(subscription);
    return this.toResponse(saved);
  }

  /**
   * Fan cancels an active subscription to a creator.
   */
  async cancel(
    fanId: number,
    creatorId: number,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { fanId, creatorId, status: 'active' },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription to this creator');
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    const saved = await this.subscriptionRepository.save(subscription);
    return this.toResponse(saved);
  }

  /**
   * Fan lists their own active subscriptions (paginated).
   */
  async listMySubscriptions(
    fanId: number,
    query: SubscriptionQueryDto,
  ): Promise<PaginatedResponseDto<SubscriptionResponseDto>> {
    const { page, limit } = this.normalizePagination(query);

    const [rows, totalCount] = await this.subscriptionRepository.findAndCount({
      where: { fanId, status: 'active' },
      order: { subscribedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: rows.map((row) => this.toResponse(row)),
      pagination: this.buildMeta(page, limit, totalCount),
    };
  }

  /**
   * Creator lists their own subscribers (paginated). Ownership is enforced by
   * the caller passing their authenticated user id as creatorId.
   */
  async listMySubscribers(
    creatorId: number,
    query: SubscriptionQueryDto,
  ): Promise<PaginatedResponseDto<SubscriberResponseDto>> {
    const { page, limit } = this.normalizePagination(query);

    const [rows, totalCount] = await this.subscriptionRepository.findAndCount({
      where: { creatorId, status: 'active' },
      order: { subscribedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data: SubscriberResponseDto[] = rows.map((row) => ({
      id: row.id,
      fanId: row.fanId,
      subscribedAt: row.subscribedAt,
    }));

    return {
      data,
      pagination: this.buildMeta(page, limit, totalCount),
    };
  }

  private normalizePagination(query: SubscriptionQueryDto): {
    page: number;
    limit: number;
  } {
    return {
      page: query.page && query.page > 0 ? query.page : 1,
      limit: query.limit && query.limit > 0 ? query.limit : 20,
    };
  }

  private buildMeta(
    page: number,
    limit: number,
    totalCount: number,
  ): PaginationMetaDto {
    return {
      hasMore: page * limit < totalCount,
      totalCount,
      limit,
    };
  }

  private toResponse(subscription: Subscription): SubscriptionResponseDto {
    return {
      id: subscription.id,
      fanId: subscription.fanId,
      creatorId: subscription.creatorId,
      status: subscription.status,
      subscribedAt: subscription.subscribedAt,
      cancelledAt: subscription.cancelledAt,
    };
  }
}
