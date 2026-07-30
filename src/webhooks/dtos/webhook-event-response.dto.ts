import { WebhookEventStatus } from '../webhook-event.entity';

export class WebhookEventResponseDto {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: WebhookEventStatus;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
}
