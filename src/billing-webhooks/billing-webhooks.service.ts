import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { AppLogger } from '../logger/app-logger.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.enum';
import { BillingWebhookEvent } from './billing-webhook-event.entity';
import { BillingCustomerMap } from './billing-customer-map.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import {
  InvalidBillingWebhookSignatureError,
  verifyBillingWebhookSignature,
} from './billing-webhook-signature';
import {
  BillingWebhookPayload,
  PAYMENT_FAILED,
  SUBSCRIPTION_ACTIVATED,
  SUBSCRIPTION_CANCELLED,
} from './billing-webhook-payload.interface';
import { QueryWebhookEventsDto } from './dtos/query-webhook-events.dto';

const POSTGRES_UNIQUE_VIOLATION = '23505';

export const MAX_BILLING_WEBHOOK_BODY_BYTES = 64 * 1024;

export interface WebhookProcessingOutcome {
  eventId: string;
  type: string;
  status: BillingWebhookEvent['status'];
  error: string | null;
  duplicate: boolean;
}

@Injectable()
export class BillingWebhooksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(BillingWebhookEvent)
    private readonly eventRepository: Repository<BillingWebhookEvent>,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
    private readonly auditService: AuditService,
  ) {}

  private get secret(): string | undefined {
    return this.configService.get<string>('BILLING_WEBHOOK_SECRET');
  }

  private get isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Entry point for the controller. Verifies the signature (or enforces dev
   * mode policy), then processes the event inside a DB transaction.
   */
  async handleIncoming(
    rawBody: Buffer | undefined,
    signatureHeader: string | undefined,
  ): Promise<WebhookProcessingOutcome> {
    const startedAt = Date.now();

    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Missing request body');
    }

    if (rawBody.length > MAX_BILLING_WEBHOOK_BODY_BYTES) {
      throw new PayloadTooLargeException('Webhook payload too large');
    }

    this.verifySignature(rawBody, signatureHeader);

    let payload: BillingWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as BillingWebhookPayload;
    } catch {
      throw new BadRequestException('Malformed JSON body');
    }

    if (!payload?.id || !payload?.type) {
      throw new BadRequestException(
        'Webhook payload must include "id" and "type"',
      );
    }

    const outcome = await this.processEvent(payload, Boolean(signatureHeader));

    const latencyMs = Date.now() - startedAt;
    this.logger.log(
      `Billing webhook processed: eventId=${outcome.eventId} type=${outcome.type} status=${outcome.status} duplicate=${outcome.duplicate} latencyMs=${latencyMs}`,
      BillingWebhooksService.name,
    );

    return outcome;
  }

  private verifySignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): void {
    const secret = this.secret;

    if (!secret) {
      if (this.isProduction) {
        // Should be unreachable — boot fails without a secret in prod, see
        // env.validation.ts — but reject defensively rather than trust it.
        throw new UnauthorizedException(
          'Billing webhook secret is not configured',
        );
      }
      this.logger.warn(
        'BILLING_WEBHOOK_SECRET is not set — accepting billing webhook without signature verification. This is only safe in local development.',
        BillingWebhooksService.name,
      );
      return;
    }

    try {
      verifyBillingWebhookSignature(rawBody, signatureHeader, secret);
    } catch (error) {
      if (error instanceof InvalidBillingWebhookSignatureError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  /**
   * Inserts the event row and applies the subscription mutation atomically.
   * Duplicate eventId deliveries short-circuit via the unique index on
   * eventId: the losing insert raises a unique violation, we roll back
   * (undoing nothing but our own attempted insert), then report the
   * already-committed outcome.
   */
  private async processEvent(
    payload: BillingWebhookPayload,
    signaturePresent: boolean,
  ): Promise<WebhookProcessingOutcome> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let inserted: BillingWebhookEvent;
    try {
      inserted = await queryRunner.manager.save(BillingWebhookEvent, {
        eventId: payload.id,
        type: payload.type,
        payload: payload as unknown as Record<string, unknown>,
        status: 'processing',
        signaturePresent,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();

      if (this.isUniqueViolation(error)) {
        return this.recordDuplicateDelivery(payload.id, payload.type);
      }
      throw error;
    }

    let finalStatus: BillingWebhookEvent['status'];
    let errorMessage: string | null = null;

    try {
      if (!this.isSupportedType(payload.type)) {
        finalStatus = 'ignored';
      } else {
        await this.applyMutation(queryRunner.manager, payload);
        finalStatus = 'processed';
      }
    } catch (error) {
      finalStatus = 'failed';
      errorMessage = (error as Error).message;
    }

    await queryRunner.manager.update(BillingWebhookEvent, inserted.id, {
      status: finalStatus,
      error: errorMessage,
      processedAt: new Date(),
    });

    await queryRunner.commitTransaction();
    await queryRunner.release();

    await this.audit(payload, finalStatus, errorMessage);

    return {
      eventId: payload.id,
      type: payload.type,
      status: finalStatus,
      error: errorMessage,
      duplicate: false,
    };
  }

  private isSupportedType(
    type: string,
  ): type is
    | typeof SUBSCRIPTION_ACTIVATED
    | typeof SUBSCRIPTION_CANCELLED
    | typeof PAYMENT_FAILED {
    return (
      type === SUBSCRIPTION_ACTIVATED ||
      type === SUBSCRIPTION_CANCELLED ||
      type === PAYMENT_FAILED
    );
  }

  private async applyMutation(
    manager: EntityManager,
    payload: BillingWebhookPayload,
  ): Promise<void> {
    const externalSubscriptionId = payload.data?.subscriptionId;
    const externalCustomerId = payload.data?.customerId;

    if (!externalSubscriptionId || !externalCustomerId) {
      throw new Error(
        `Cannot process ${payload.type}: payload is missing data.subscriptionId/data.customerId`,
      );
    }

    let map = await manager.findOne(BillingCustomerMap, {
      where: { externalSubscriptionId },
    });

    if (payload.type === SUBSCRIPTION_ACTIVATED) {
      if (!map) {
        const { fanId, creatorId } = payload.data ?? {};
        if (!fanId || !creatorId) {
          throw new Error(
            `Cannot activate subscription: no BillingCustomerMap for external subscription "${externalSubscriptionId}" and payload did not include fanId/creatorId to create one. ` +
              'Ensure the checkout flow persists the mapping before the provider webhook fires.',
          );
        }
        map = await manager.save(BillingCustomerMap, {
          externalCustomerId,
          externalSubscriptionId,
          fanId,
          creatorId,
        });
      }

      const existing = await manager.findOne(Subscription, {
        where: { fanId: map.fanId, creatorId: map.creatorId },
      });

      if (existing) {
        existing.status = 'active';
        existing.cancelledAt = null;
        existing.subscribedAt = new Date();
        await manager.save(Subscription, existing);
      } else {
        await manager.save(Subscription, {
          fanId: map.fanId,
          creatorId: map.creatorId,
          status: 'active',
          cancelledAt: null,
        });
      }
      return;
    }

    // subscription.cancelled / payment.failed both require an existing
    // mapping — there is no local subscription to mutate otherwise.
    if (!map) {
      throw new Error(
        `Cannot process ${payload.type}: no BillingCustomerMap found for external subscription "${externalSubscriptionId}". ` +
          'The subscription was never activated locally, or the mapping was not recorded.',
      );
    }

    const subscription = await manager.findOne(Subscription, {
      where: { fanId: map.fanId, creatorId: map.creatorId },
    });

    if (!subscription) {
      throw new Error(
        `Cannot process ${payload.type}: BillingCustomerMap resolved to fanId=${map.fanId} creatorId=${map.creatorId} but no Subscription row exists for that pair.`,
      );
    }

    if (payload.type === SUBSCRIPTION_CANCELLED) {
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
    } else {
      subscription.status = 'past_due';
    }

    await manager.save(Subscription, subscription);
  }

  private async recordDuplicateDelivery(
    eventId: string,
    type: string,
  ): Promise<WebhookProcessingOutcome> {
    const existing = await this.eventRepository.findOne({
      where: { eventId },
    });

    if (!existing) {
      // Extremely unlikely: the row that caused the unique violation should
      // be visible once its transaction committed. Surface a clear error
      // rather than silently pretending success.
      throw new Error(
        `Duplicate delivery detected for eventId=${eventId} but no committed event row was found`,
      );
    }

    await this.eventRepository.increment(
      { id: existing.id },
      'deliveryAttempts',
      1,
    );

    this.logger.log(
      `Duplicate billing webhook delivery ignored: eventId=${eventId} type=${type} recordedStatus=${existing.status}`,
      BillingWebhooksService.name,
    );

    return {
      eventId,
      type,
      status: existing.status,
      error: existing.error,
      duplicate: true,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as unknown as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }

  private async audit(
    payload: BillingWebhookPayload,
    status: BillingWebhookEvent['status'],
    error: string | null,
  ): Promise<void> {
    const actionMap: Record<string, AuditAction> = {
      [SUBSCRIPTION_ACTIVATED]:
        AuditAction.BILLING_WEBHOOK_SUBSCRIPTION_ACTIVATED,
      [SUBSCRIPTION_CANCELLED]:
        AuditAction.BILLING_WEBHOOK_SUBSCRIPTION_CANCELLED,
      [PAYMENT_FAILED]: AuditAction.BILLING_WEBHOOK_PAYMENT_FAILED,
    };

    const action =
      status === 'ignored'
        ? AuditAction.BILLING_WEBHOOK_EVENT_IGNORED
        : status === 'failed'
          ? AuditAction.BILLING_WEBHOOK_EVENT_FAILED
          : (actionMap[payload.type] ??
            AuditAction.BILLING_WEBHOOK_EVENT_IGNORED);

    await this.auditService.log({
      actorId: null,
      action,
      targetType: 'billing_webhook_event',
      targetId: null,
      metadata: {
        eventId: payload.id,
        type: payload.type,
        status,
        error,
        externalSubscriptionId: payload.data?.subscriptionId ?? null,
      },
    });
  }

  async listEvents(query: QueryWebhookEventsDto): Promise<{
    data: BillingWebhookEvent[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.eventRepository.createQueryBuilder('event');
    if (query.status) {
      qb.andWhere('event.status = :status', { status: query.status });
    }
    qb.orderBy('event.receivedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}
