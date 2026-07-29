import { Injectable } from '@nestjs/common';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Post } from './post.entity';

export interface PostViewer {
  userId: number;
}

/**
 * Single source of truth for "who can see this post". Used by both the list
 * and detail read paths so the rules never drift between endpoints.
 *
 * Visibility matrix (see docs/post-visibility.md):
 *  - public        -> everyone, including anonymous callers
 *  - subscribers   -> the owning creator, or a fan with an ACTIVE subscription
 *                     to that creator. cancelled subscriptions never unlock
 *                     this content (SubscriptionStatus only has
 *                     'active' | 'cancelled' in this schema — there is no
 *                     expired/past_due state to special-case).
 *  - private/draft -> not modeled on Post in this codebase (N/A); only
 *                     'public' | 'subscribers' exist.
 */
@Injectable()
export class PostVisibilityService {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Whether subscriber-only content should be included for this viewer
   * against this specific creator. Computed once per request (not once per
   * post) so list endpoints never do N+1 subscription lookups.
   */
  async canViewSubscriberContent(
    viewer: PostViewer | undefined,
    creatorUserId: number,
  ): Promise<boolean> {
    if (!viewer) return false;
    if (viewer.userId === creatorUserId) return true; // owner
    return this.subscriptionsService.isActiveSubscriber(
      viewer.userId,
      creatorUserId,
    );
  }

  async canViewPost(
    post: Post,
    viewer: PostViewer | undefined,
    creatorUserId: number,
  ): Promise<boolean> {
    if (post.visibility === 'public') return true;
    return this.canViewSubscriberContent(viewer, creatorUserId);
  }
}
