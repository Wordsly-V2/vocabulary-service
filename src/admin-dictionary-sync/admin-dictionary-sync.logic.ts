import { INCOMPLETE, MISSING_IMAGE } from '@/admin-vocabulary/word-health.sql';
import type { SyncField } from '@/dictionary/word-sync.logic';
import { Prisma } from '@prisma/client';
import type { WordSyncJob } from '@prisma/client';
import type {
    SyncItemStatus,
    SyncJob,
    SyncJobStatus,
    SyncScope,
} from './dto/admin-dictionary-sync.dto';

export interface ScopeInput {
    scope: SyncScope;
    targetId?: string;
    wordIds?: string[];
}

/** Why a scope can't run as given, or null when it can. */
export function scopeProblem({
    scope,
    targetId,
    wordIds,
}: ScopeInput): string | null {
    const needsTarget: SyncScope[] = ['user', 'course', 'lesson', 'retry'];
    if (needsTarget.includes(scope) && !targetId) {
        return `targetId is required for the ${scope} scope`;
    }
    if (scope === 'words' && !wordIds?.length) {
        return 'wordIds is required for the words scope';
    }
    return null;
}

/**
 * The words a scope covers, as a condition over `words w`, `lessons l` and
 * `courses c` (joined). `health` means incomplete or missing an image, over
 * one course when `targetId` is given. `retry` takes the earlier run's
 * failed and unfinished words.
 */
export function scopeCondition({
    scope,
    targetId,
    wordIds,
}: ScopeInput): Prisma.Sql {
    switch (scope) {
        case 'all':
            return Prisma.sql`TRUE`;
        case 'official':
            return Prisma.sql`c."userLoginId" IS NULL`;
        case 'user':
            return Prisma.sql`c."userLoginId" = ${targetId}::uuid`;
        case 'course':
            return Prisma.sql`c."id" = ${targetId}::uuid`;
        case 'lesson':
            return Prisma.sql`w."lessonId" = ${targetId}::uuid`;
        case 'words':
            return Prisma.sql`w."id" = ANY(${wordIds ?? []}::uuid[])`;
        case 'health': {
            const gaps = Prisma.sql`(${INCOMPLETE} OR ${MISSING_IMAGE})`;
            return targetId
                ? Prisma.sql`${gaps} AND c."id" = ${targetId}::uuid`
                : gaps;
        }
        case 'retry':
            return Prisma.sql`w."id" IN (
                SELECT i."word_id" FROM "word_sync_items" i
                WHERE i."job_id" = ${targetId}::uuid
                  AND i."status" IN ('error', 'pending'))`;
    }
}

/** The job counter an item outcome bumps. */
export function counterFor(
    status: Exclude<SyncItemStatus, 'pending'>,
): 'updated' | 'skipped' | 'errored' {
    return status === 'error' ? 'errored' : status;
}

export function percentDone(done: number, total: number): number {
    if (total <= 0) return 100;
    return Math.min(100, Math.floor((done / total) * 100));
}

export function toSyncJob(row: WordSyncJob): SyncJob {
    return {
        id: row.id,
        scope: row.scope as SyncScope,
        targetId: row.targetId,
        scopeLabel: row.scopeLabel,
        fields: row.fields as SyncField[],
        mode: row.mode,
        status: row.status as SyncJobStatus,
        total: row.total,
        done: row.done,
        updated: row.updated,
        skipped: row.skipped,
        errored: row.errored,
        percent: percentDone(row.done, row.total),
        createdBy: row.createdBy,
        retryOfId: row.retryOfId,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
    };
}
