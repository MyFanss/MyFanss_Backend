// Minimal Stripe-style envelope this stub understands. Real provider
// payloads carry far more; we only require what the supported event types
// need to resolve a local subscription and stay idempotent.
export interface BillingWebhookPayload {
  id: string;
  type: string;
  data?: {
    customerId?: string;
    subscriptionId?: string;
    // Present only on first activation, when there is no BillingCustomerMap
    // row yet to resolve the external ids to a local fan/creator pair.
    fanId?: number;
    creatorId?: number;
  };
}

export const SUBSCRIPTION_ACTIVATED = 'subscription.activated';
export const SUBSCRIPTION_CANCELLED = 'subscription.cancelled';
export const PAYMENT_FAILED = 'payment.failed';

export const SUPPORTED_BILLING_EVENT_TYPES = [
  SUBSCRIPTION_ACTIVATED,
  SUBSCRIPTION_CANCELLED,
  PAYMENT_FAILED,
] as const;
