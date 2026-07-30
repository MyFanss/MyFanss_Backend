export const WEBHOOK_EVENT_TYPES = {
  SUBSCRIPTION_CREATED: 'subscription.created',
  POST_PUBLISHED: 'post.published',
  TIP_CREATED: 'tip.created',
} as const;

export type WebhookEventType =
  (typeof WEBHOOK_EVENT_TYPES)[keyof typeof WEBHOOK_EVENT_TYPES];
