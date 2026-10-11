import type { ThrottlerOptions } from '@nestjs/throttler';

/** The generous bucket for dictionary lookups. */
export const LOOKUP_THROTTLER = 'lookup';
/** The tight bucket for starting a learner's word sync. */
export const SCRAPE_SYNC_THROTTLER = 'scrape-sync';

/**
 * Every named throttler applies to every route its guard covers, at these
 * defaults, unless the route skips it by name. `@SkipThrottle()` with no
 * argument only skips a throttler called `default`, which doesn't exist here,
 * so a route that should be exempt has to name each bucket.
 */
export const THROTTLERS: ThrottlerOptions[] = [
    { name: LOOKUP_THROTTLER, ttl: 60_000, limit: 60 },
    { name: SCRAPE_SYNC_THROTTLER, ttl: 60_000, limit: 5 },
];
