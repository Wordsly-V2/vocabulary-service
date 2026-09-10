import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '@/auth/jwt/authenticated-request';

/**
 * Rate limit keyed on the caller, not their address.
 *
 * Every request to this service arrives from the gateway, so the default
 * IP-based tracker would give the whole user base a single bucket: one learner
 * running a bulk sync would throttle everyone else. The access token's subject
 * is the only meaningful identity here, and AccessGuard has already verified it
 * by the time this runs.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
    protected getTracker(req: AuthenticatedRequest): Promise<string> {
        // Falls back to the address for @Public() routes, which have no subject.
        return Promise.resolve(req.user?.sub ?? req.ip ?? 'unknown');
    }
}
