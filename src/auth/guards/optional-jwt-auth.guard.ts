import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Same JWT strategy as JwtAuthGuard, but never rejects the request.
 *
 * Used on public read endpoints that must behave correctly both for
 * anonymous callers (public content only) and authenticated callers
 * (subscriber/owner content unlocked). A missing, malformed or expired
 * token simply results in `request.user` being undefined rather than a 401 —
 * downstream visibility logic treats that as an anonymous viewer.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    _err: unknown,
    user: TUser | false,
  ): TUser | undefined {
    return user ? user : undefined;
  }
}
