import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { userCachePattern } from './cache-keys';
import { CACHE_TTL_SECONDS, CacheKind } from './cache-ttl';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(CacheService.name);
    private client: Redis | null = null;
    private readonly keyPrefix = 'vocab';

    constructor(private readonly configService: ConfigService) {}

    get isEnabled(): boolean {
        return this.client !== null;
    }

    async onModuleInit(): Promise<void> {
        const url = this.configService.get<string>('redis.url');
        if (!url) {
            this.logger.warn('REDIS_URL not set; caching is disabled');
            return;
        }

        const client = new Redis(url, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
        });

        try {
            await client.connect();
            this.client = client;
            this.logger.log('Redis cache connected');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
                `Redis connection failed; caching disabled: ${message}`,
            );
            client.disconnect();
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.client?.quit();
    }

    userKey(userLoginId: string, ...parts: string[]): string {
        return `${this.keyPrefix}:u:${userLoginId}:${parts.join(':')}`;
    }

    /** Key for user-independent data (e.g. dictionary lookups); survives per-user invalidation. */
    private globalKey(...parts: string[]): string {
        return `${this.keyPrefix}:g:${parts.join(':')}`;
    }

    async getOrSetGlobal<T>(
        keyParts: string[],
        factory: () => Promise<T>,
        kind: CacheKind,
    ): Promise<T> {
        return this.getOrSetByKey(this.globalKey(...keyParts), factory, kind);
    }

    async getOrSet<T>(
        userLoginId: string,
        keyParts: string[],
        factory: () => Promise<T>,
        kind: CacheKind,
    ): Promise<T> {
        return this.getOrSetByKey(
            this.userKey(userLoginId, ...keyParts),
            factory,
            kind,
        );
    }

    private async getOrSetByKey<T>(
        key: string,
        factory: () => Promise<T>,
        kind: CacheKind,
    ): Promise<T> {
        if (!this.client) {
            return factory();
        }

        try {
            const cached = await this.client.get(key);
            if (cached !== null) {
                return JSON.parse(cached) as T;
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Cache read failed for ${key}: ${message}`);
        }

        const value = await factory();

        try {
            await this.client.set(
                key,
                JSON.stringify(value),
                'EX',
                CACHE_TTL_SECONDS[kind],
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Cache write failed for ${key}: ${message}`);
        }

        return value;
    }

    /**
     * Creates/overwrites a hash at `key` with the given fields and sets a TTL.
     * No-op (returns false) when Redis is disabled.
     */
    async hInit(
        key: string,
        fields: Record<string, string | number>,
        ttlSeconds: number,
    ): Promise<boolean> {
        if (!this.client) {
            return false;
        }
        try {
            const flat: (string | number)[] = [];
            for (const [k, v] of Object.entries(fields)) {
                flat.push(k, v);
            }
            await this.client
                .multi()
                .hset(key, ...flat)
                .expire(key, ttlSeconds)
                .exec();
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`hInit failed for ${key}: ${message}`);
            return false;
        }
    }

    /**
     * Atomically increments a hash field, returning the new value (or null when
     * Redis is disabled or the op fails).
     */
    async hIncr(key: string, field: string, by = 1): Promise<number | null> {
        if (!this.client) {
            return null;
        }
        try {
            return await this.client.hincrby(key, field, by);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`hIncr failed for ${key}.${field}: ${message}`);
            return null;
        }
    }

    /** Sets one or more hash fields. No-op when Redis is disabled. */
    async hSet(
        key: string,
        fields: Record<string, string | number>,
    ): Promise<void> {
        if (!this.client) {
            return;
        }
        try {
            const flat: (string | number)[] = [];
            for (const [k, v] of Object.entries(fields)) {
                flat.push(k, v);
            }
            await this.client.hset(key, ...flat);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`hSet failed for ${key}: ${message}`);
        }
    }

    /** Reads all fields of a hash, or null when missing / Redis disabled. */
    async hGetAll(key: string): Promise<Record<string, string> | null> {
        if (!this.client) {
            return null;
        }
        try {
            const data = await this.client.hgetall(key);
            return data && Object.keys(data).length > 0 ? data : null;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`hGetAll failed for ${key}: ${message}`);
            return null;
        }
    }

    async invalidateUser(userLoginId: string): Promise<void> {
        if (!this.client) {
            return;
        }

        const pattern = userCachePattern(userLoginId);
        try {
            await this.deleteByPattern(pattern);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
                `Cache invalidation failed for user ${userLoginId}: ${message}`,
            );
        }
    }

    private async deleteByPattern(pattern: string): Promise<void> {
        if (!this.client) {
            return;
        }

        let cursor = '0';
        do {
            const [nextCursor, keys] = await this.client.scan(
                cursor,
                'MATCH',
                pattern,
                'COUNT',
                100,
            );
            cursor = nextCursor;
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
        } while (cursor !== '0');
    }
}
