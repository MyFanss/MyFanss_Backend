import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EntityManager, LessThanOrEqual, Repository } from 'typeorm';
import { WebhookEvent } from './webhook-event.entity';
import { redactWebhookPayload } from './redact-webhook-payload.util';
import { QueryWebhookEventsDto } from './dtos/query-webhook-events.dto';
import { AppLogger } from '../logger/app-logger.service';

export const WEBHOOK_MAX_ATTEMPTS = 5;
export const WEBHOOK_BASE_BACKOFF_MS = 1000;
export const WEBHOOK_MAX_BACKOFF_MS = 5 * 60 * 1000;
const DEFAULT_DISPATCH_BATCH_SIZE = 20;

export interface DispatchOutcome {
  processed: number;
  delivered: number;
  failed: number;
  dead: number;
}

/**
 * Transactional outbox for platform events. Emitters write a durable
 * `pending` row (optionally inside the same DB transaction as the domain
 * write via the `manager` param); a separate dispatch pass — triggered
 * explicitly by an admin/test call rather than an in-process timer, since
 * this stub has no cron provider — delivers them with exponential backoff.
 */
@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookEvent)
    private readonly eventRepository: Repository<WebhookEvent>,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Durably records a platform event. Payload is redacted before it ever
   * touches the database. Pass the domain write's transaction manager so the
   * outbox row commits atomically with it; omit it to write standalone.
   */
  async emit(
    eventType: string,
    payload: Record<string, unknown>,
    manager?: EntityManager,
  ): Promise<WebhookEvent> {
    const repo = manager
      ? manager.getRepository(WebhookEvent)
      : this.eventRepository;

    const event = repo.create({
      eventType,
      payload: redactWebhookPayload(payload),
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      deliveredAt: null,
    });

    return repo.save(event);
  }

  /**
   * Processes up to `batchSize` due pending events one at a time. A sink
   * failure only ever mutates that event's own row (attempts/backoff/dead),
   * so it can never roll back or otherwise affect the domain write that
   * originally emitted the event.
   */
  async dispatch(
    batchSize: number = DEFAULT_DISPATCH_BATCH_SIZE,
  ): Promise<DispatchOutcome> {
    const due = await this.eventRepository.find({
      where: { status: 'pending', nextAttemptAt: LessThanOrEqual(new Date()) },
      order: { nextAttemptAt: 'ASC' },
      take: batchSize,
    });

    const outcome: DispatchOutcome = {
      processed: 0,
      delivered: 0,
      failed: 0,
      dead: 0,
    };

    for (const event of due) {
      outcome.processed += 1;
      await this.dispatchOne(event, outcome);
    }

    return outcome;
  }

  private async dispatchOne(
    event: WebhookEvent,
    outcome: DispatchOutcome,
  ): Promise<void> {
    try {
      await this.deliver(event);
      event.status = 'delivered';
      event.deliveredAt = new Date();
      event.lastError = null;
      await this.eventRepository.save(event);
      outcome.delivered += 1;
    } catch (error) {
      const attempts = event.attempts + 1;
      event.attempts = attempts;
      event.lastError = (error as Error).message;

      if (attempts >= WEBHOOK_MAX_ATTEMPTS) {
        event.status = 'dead';
        outcome.dead += 1;
      } else {
        event.status = 'pending';
        event.nextAttemptAt = new Date(Date.now() + this.backoffMs(attempts));
        outcome.failed += 1;
      }

      await this.eventRepository.save(event);
    }
  }

  /**
   * Dev sink: posts to WEBHOOK_DEBUG_URL if configured (a non-2xx response
   * or network error counts as failed delivery), otherwise just logs — this
   * is a stub, not a real partner-delivery client.
   */
  private async deliver(event: WebhookEvent): Promise<void> {
    const debugUrl = this.configService.get<string>('WEBHOOK_DEBUG_URL');

    if (!debugUrl) {
      this.logger.log(
        `[webhook] ${event.eventType} ${JSON.stringify(event.payload)}`,
        WebhooksService.name,
      );
      return;
    }

    const response = await fetch(debugUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: event.id,
        eventType: event.eventType,
        payload: event.payload,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook sink responded with status ${response.status}`);
    }
  }

  private backoffMs(attempts: number): number {
    const delay = WEBHOOK_BASE_BACKOFF_MS * 2 ** (attempts - 1);
    return Math.min(delay, WEBHOOK_MAX_BACKOFF_MS);
  }

  /**
   * Resets a dead event back to pending for redelivery. Only dead events can
   * be retried — pending/delivered/failed events are already on (or past)
   * the normal dispatch path.
   */
  async retry(id: string): Promise<WebhookEvent> {
    const event = await this.eventRepository.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Webhook event not found');
    if (event.status !== 'dead') {
      throw new ConflictException('Only dead events can be retried');
    }

    event.status = 'pending';
    event.attempts = 0;
    event.nextAttemptAt = new Date();
    event.lastError = null;
    return this.eventRepository.save(event);
  }

  async listEvents(query: QueryWebhookEventsDto): Promise<{
    data: WebhookEvent[];
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
    qb.orderBy('event.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}
