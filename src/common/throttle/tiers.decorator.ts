import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_TIER_KEY } from './extended-throttler-guard';

/**
 * Decorator to apply a "auth" rate-limit tier (strict).
 * Auth endpoints: login, signup, refresh, etc.
 */
export const AuthTier = () => SetMetadata(RATE_LIMIT_TIER_KEY, 'auth');

/**
 * Decorator to apply a "short" rate-limit tier.
 * Used for lightweight, frequent operations.
 */
export const ShortTier = () => SetMetadata(RATE_LIMIT_TIER_KEY, 'short');

/**
 * Decorator to apply a "medium" rate-limit tier (default).
 * Used for general API endpoints.
 */
export const MediumTier = () => SetMetadata(RATE_LIMIT_TIER_KEY, 'medium');

/**
 * Decorator to apply a "long" rate-limit tier (generous).
 * Used for read-heavy, low-risk endpoints.
 */
export const LongTier = () => SetMetadata(RATE_LIMIT_TIER_KEY, 'long');

/**
 * Decorator to exempt a route from rate limiting.
 * Used for health checks, metrics endpoints.
 */
export const ExemptTier = () => SetMetadata(RATE_LIMIT_TIER_KEY, 'exempt');
