import {
    SYNC_FIELDS,
    SYNC_MODES,
    type SyncField,
} from '@/dictionary/word-sync.logic';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsIn,
    IsInt,
    IsOptional,
    IsUUID,
    Max,
    Min,
} from 'class-validator';

/**
 * Which words a run covers. `targetId` is a learner's `UserLoginId` for
 * `user`, a course id for `course` (and optionally `health`), a lesson id for
 * `lesson`, and the earlier job for `retry` (only through `jobs/:id/retry`).
 */
export const SYNC_SCOPES = [
    'all',
    'official',
    'user',
    'course',
    'lesson',
    'words',
    'health',
    'retry',
] as const;
export type SyncScope = (typeof SYNC_SCOPES)[number];

/** The scopes an admin can start a run with directly. */
export const START_SCOPES = SYNC_SCOPES.filter(
    (scope): scope is Exclude<SyncScope, 'retry'> => scope !== 'retry',
);

/** `failed` = the words could not be enqueued (Kafka went away mid-start). */
export const SYNC_JOB_STATUSES = [
    'running',
    'completed',
    'cancelled',
    'failed',
] as const;
export type SyncJobStatus = (typeof SYNC_JOB_STATUSES)[number];

export const SYNC_ITEM_STATUSES = [
    'pending',
    'updated',
    'skipped',
    'error',
] as const;
export type SyncItemStatus = (typeof SYNC_ITEM_STATUSES)[number];

/** Cap on hand-picked words in one run. */
export const MAX_SYNC_WORD_IDS = 500;
/** Page size cap for job and item lists. */
export const MAX_SYNC_PAGE_SIZE = 50;

export class SyncScopeDto {
    @ApiProperty({ enum: START_SCOPES })
    @IsIn(START_SCOPES)
    scope: Exclude<SyncScope, 'retry'>;

    @ApiPropertyOptional({
        description:
            'User (user), course (course, health) or lesson (lesson) id',
    })
    @IsOptional()
    @IsUUID()
    targetId?: string;

    @ApiPropertyOptional({
        type: [String],
        description: `Word ids for the words scope (max ${MAX_SYNC_WORD_IDS})`,
    })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(MAX_SYNC_WORD_IDS)
    @IsUUID('all', { each: true })
    wordIds?: string[];
}

export class StartSyncDto extends SyncScopeDto {
    @ApiProperty({ enum: SYNC_FIELDS, isArray: true })
    @IsArray()
    @ArrayMinSize(1)
    @IsIn(SYNC_FIELDS, { each: true })
    fields: SyncField[];

    @ApiProperty({ enum: SYNC_MODES })
    @IsIn(SYNC_MODES)
    mode: (typeof SYNC_MODES)[number];
}

class PageQueryDto {
    @ApiPropertyOptional({ example: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_SYNC_PAGE_SIZE)
    limit?: number;
}

export class SyncJobsQueryDto extends PageQueryDto {
    @ApiPropertyOptional({ enum: SYNC_JOB_STATUSES })
    @IsOptional()
    @IsIn(SYNC_JOB_STATUSES)
    status?: SyncJobStatus;
}

export class SyncItemsQueryDto extends PageQueryDto {
    @ApiPropertyOptional({ enum: SYNC_ITEM_STATUSES })
    @IsOptional()
    @IsIn(SYNC_ITEM_STATUSES)
    status?: SyncItemStatus;
}

/** `POST /admin/vocabulary/sync/preview`. */
export interface SyncPreview {
    total: number;
    scopeLabel: string;
}

/** A sync run as the admin panel shows it. */
export interface SyncJob {
    id: string;
    scope: SyncScope;
    targetId: string | null;
    scopeLabel: string;
    fields: SyncField[];
    mode: string;
    status: SyncJobStatus;
    total: number;
    done: number;
    updated: number;
    skipped: number;
    errored: number;
    /** 0–100, from done / total. */
    percent: number;
    createdBy: string;
    retryOfId: string | null;
    startedAt: Date;
    finishedAt: Date | null;
}

/** One word of a run. */
export interface SyncItem {
    wordId: string;
    word: string;
    partOfSpeech: string | null;
    status: SyncItemStatus;
    reason: string | null;
    changedFields: string[];
    processedAt: Date | null;
}
