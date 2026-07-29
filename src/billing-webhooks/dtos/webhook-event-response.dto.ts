import { BillingWebhookEventStatus } from '../billing-webhook-event.entity';

export class WebhookEventResponseDto {
  eventId: string;
  type: string;
  status: BillingWebhookEventStatus;
  error: string | null;
  receivedAt: Date;
  processedAt: Date | null;
}

export class AdminWebhookEventResponseDto extends WebhookEventResponseDto {
  id: string;
  payload: Record<string, unknown>;
  signaturePresent: boolean;
  processingLatencyMs: number | null;
  deliveryAttempts: number;
}
