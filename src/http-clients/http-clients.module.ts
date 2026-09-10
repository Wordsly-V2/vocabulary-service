import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';

/**
 * Outbound HTTP, used by the dictionary scraper to reach Langeek and Cambridge.
 *
 * The timeout is the point. These are third-party sites this service does not
 * control: registered with no options, a site that accepted the connection and
 * then stalled would hold the request — and, through the Kafka sync path, a
 * consumer — open indefinitely. Mirrors the 15s the learning-service peer
 * client already uses.
 */
const EXTERNAL_HTTP_TIMEOUT_MS = 15_000;
/** A redirect loop on a scraped page must not become an infinite fetch. */
const MAX_REDIRECTS = 5;

@Global()
@Module({
    imports: [
        HttpModule.register({
            timeout: EXTERNAL_HTTP_TIMEOUT_MS,
            maxRedirects: MAX_REDIRECTS,
        }),
    ],
    exports: [HttpModule],
})
export class HttpClientsModule {}
