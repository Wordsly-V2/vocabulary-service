import type { ProcessWordSyncResultDto } from '@/dictionary/dto/dictionary.dto';
import type { SyncField, SyncMode } from '@/dictionary/word-sync.logic';
import { DICTIONARY_SYNC_WORD_LANGEEK_TOPIC } from '@/messaging/constants';
import { KafkaProducerService } from '@/messaging/kafka-producer.service';
import { PrismaService } from '@/prisma/prisma.service';
import type { Pagination } from '@/types/common/pagination.type';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import {
    counterFor,
    type ScopeInput,
    scopeCondition,
    scopeProblem,
    toSyncJob,
} from './admin-dictionary-sync.logic';
import type {
    StartSyncDto,
    SyncItem,
    SyncItemStatus,
    SyncItemsQueryDto,
    SyncJob,
    SyncJobsQueryDto,
    SyncPreview,
} from './dto/admin-dictionary-sync.dto';

/** What the consumer needs to process one word of a run. */
export interface SyncRunSettings {
    fields: SyncField[];
    mode: SyncMode;
    running: boolean;
}

/** Words enqueued per Kafka batch. */
const ENQUEUE_PAGE_SIZE = 500;
/** How long the consumer trusts a run's settings before re-reading them. */
const SETTINGS_TTL_MS = 3_000;
/** Serializes starts, so two admins can't both start "the one running job". */
const START_LOCK_KEY = 'word_sync_jobs:start';

/**
 * Admin Langeek sync runs under `/admin/vocabulary/sync`.
 *
 * A run lists its words in `word_sync_items` and sends one Kafka message per
 * word on the learner sync's topic, with `adminJobId`. The dictionary consumer
 * processes the word with the run's fields and mode, then calls `record`,
 * which marks the item and bumps the run's counters in one transaction. One
 * run at a time, to keep the load on Langeek bounded.
 */
@Injectable()
export class AdminDictionarySyncService {
    private readonly logger = new Logger(AdminDictionarySyncService.name);
    private readonly settings = new Map<
        string,
        { value: SyncRunSettings | null; at: number }
    >();

    constructor(
        private readonly prisma: PrismaService,
        private readonly kafka: KafkaProducerService,
        private readonly config: ConfigService,
    ) {}

    /** Pause between words of a run (`LANGEEK_SYNC_DELAY_MS`). */
    get delayMs(): number {
        const value = this.config.get<number>('dictionary.syncDelayMs');
        return Number.isFinite(value) && value! > 0 ? value! : 0;
    }

    async preview(input: ScopeInput): Promise<SyncPreview> {
        this.checkScope(input);
        const [{ total }] = await this.prisma.$queryRaw<{ total: number }[]>`
            SELECT count(*)::int AS total
            FROM "words" w
            JOIN "lessons" l ON l."id" = w."lessonId"
            JOIN "courses" c ON c."id" = l."courseId"
            WHERE ${scopeCondition(input)}`;
        return { total, scopeLabel: await this.label(input) };
    }

    async start(
        actor: string,
        dto: StartSyncDto,
        retryOfId?: string,
    ): Promise<SyncJob> {
        const input: ScopeInput = retryOfId
            ? { scope: 'retry', targetId: retryOfId }
            : dto;
        this.checkScope(input);
        if (!this.kafka.isEnabled) {
            throw new ServiceUnavailableException(
                'Kafka is not reachable, so a sync cannot run',
            );
        }
        const scopeLabel = await this.label(input);
        const fields = [...new Set(dto.fields)];

        const id = uuidv7();
        const job = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${START_LOCK_KEY}))`;
            const running = await tx.wordSyncJob.findFirst({
                where: { status: 'running' },
                select: { id: true },
            });
            if (running) {
                throw new ConflictException(
                    `Another sync is running (${running.id})`,
                );
            }

            await tx.wordSyncJob.create({
                data: {
                    id,
                    createdBy: actor,
                    scope: input.scope,
                    targetId: input.targetId ?? null,
                    scopeLabel,
                    fields,
                    mode: dto.mode,
                    status: 'running',
                    retryOfId: retryOfId ?? null,
                },
            });
            const total = await tx.$executeRaw`
                INSERT INTO "word_sync_items"
                    ("job_id", "word_id", "word", "part_of_speech", "status", "changed_fields")
                SELECT ${id}::uuid, w."id", w."word", w."partOfSpeech", 'pending', '{}'
                FROM "words" w
                JOIN "lessons" l ON l."id" = w."lessonId"
                JOIN "courses" c ON c."id" = l."courseId"
                WHERE ${scopeCondition(input)}`;
            if (total === 0) {
                throw new BadRequestException('No words match this scope');
            }
            return tx.wordSyncJob.update({ where: { id }, data: { total } });
        });

        try {
            await this.enqueue(id);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            await this.prisma.wordSyncJob.update({
                where: { id },
                data: { status: 'failed', finishedAt: new Date() },
            });
            this.logger.error(`Sync ${id} could not be enqueued: ${message}`);
            throw new ServiceUnavailableException(
                'The sync could not be queued; try again',
            );
        }

        this.log(actor, 'sync_start', id, {
            scope: input.scope,
            targetId: input.targetId,
            fields,
            mode: dto.mode,
            total: job.total,
        });
        return toSyncJob(job);
    }

    /** A new run over an earlier run's failed and unfinished words. */
    async retry(actor: string, jobId: string): Promise<SyncJob> {
        const source = await this.findJob(jobId);
        if (source.status === 'running') {
            throw new ConflictException('This sync is still running');
        }
        return this.start(
            actor,
            {
                scope: 'all', // unused: the retry scope replaces it
                fields: source.fields as SyncField[],
                mode: source.mode as StartSyncDto['mode'],
            },
            jobId,
        );
    }

    async cancel(actor: string, jobId: string): Promise<SyncJob> {
        const { count } = await this.prisma.wordSyncJob.updateMany({
            where: { id: jobId, status: 'running' },
            data: { status: 'cancelled', finishedAt: new Date() },
        });
        const job = await this.findJob(jobId);
        if (count === 0) {
            throw new ConflictException('Only a running sync can be cancelled');
        }
        this.settings.delete(jobId);
        this.log(actor, 'sync_cancel', jobId, { done: job.done });
        return toSyncJob(job);
    }

    async jobs(query: SyncJobsQueryDto): Promise<Pagination<SyncJob>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const where = query.status ? { status: query.status } : {};
        const [rows, totalItems] = await Promise.all([
            this.prisma.wordSyncJob.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.wordSyncJob.count({ where }),
        ]);
        return {
            items: rows.map(toSyncJob),
            currentPageItems: rows.length,
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page,
            limit,
        };
    }

    async job(jobId: string): Promise<SyncJob> {
        return toSyncJob(await this.findJob(jobId));
    }

    async items(
        jobId: string,
        query: SyncItemsQueryDto,
    ): Promise<Pagination<SyncItem>> {
        await this.findJob(jobId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const where = { jobId, ...(query.status && { status: query.status }) };
        const [rows, totalItems] = await Promise.all([
            this.prisma.wordSyncItem.findMany({
                where,
                orderBy: [
                    { processedAt: { sort: 'desc', nulls: 'last' } },
                    { word: 'asc' },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.wordSyncItem.count({ where }),
        ]);
        return {
            items: rows.map((row) => ({
                wordId: row.wordId,
                word: row.word,
                partOfSpeech: row.partOfSpeech,
                status: row.status as SyncItemStatus,
                reason: row.reason,
                changedFields: row.changedFields,
                processedAt: row.processedAt,
            })),
            currentPageItems: rows.length,
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page,
            limit,
        };
    }

    /**
     * A run's fields, mode and whether it still runs, for the consumer. Kept
     * for a few seconds so a run doesn't cost one extra query per word; a
     * cancel is picked up within that window. Null when the run is gone.
     */
    async runSettings(jobId: string): Promise<SyncRunSettings | null> {
        const cached = this.settings.get(jobId);
        if (cached && Date.now() - cached.at < SETTINGS_TTL_MS) {
            return cached.value;
        }
        const row = await this.prisma.wordSyncJob.findUnique({
            where: { id: jobId },
            select: { fields: true, mode: true, status: true },
        });
        const value = row
            ? {
                  fields: row.fields as SyncField[],
                  mode: row.mode as SyncMode,
                  running: row.status === 'running',
              }
            : null;
        this.settings.set(jobId, { value, at: Date.now() });
        return value;
    }

    /**
     * Records one word's outcome. Only a pending item moves, so a redelivered
     * message counts nothing twice; the counters and the completion flip are
     * one statement, so concurrent consumers can't miss the last word.
     */
    async record(
        jobId: string,
        wordId: string,
        result: ProcessWordSyncResultDto,
    ): Promise<void> {
        const counter = Prisma.raw(`"${counterFor(result.status)}"`);
        await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.wordSyncItem.updateMany({
                where: { jobId, wordId, status: 'pending' },
                data: {
                    status: result.status,
                    reason: result.reason?.slice(0, 500) ?? null,
                    changedFields: result.changedFields ?? [],
                    processedAt: new Date(),
                },
            });
            if (count === 0) return;
            await tx.$executeRaw`
                UPDATE "word_sync_jobs" SET
                    "done" = "done" + 1,
                    ${counter} = ${counter} + 1,
                    "updated_at" = now(),
                    "finished_at" = CASE WHEN "status" = 'running' AND "done" + 1 >= "total" THEN now() ELSE "finished_at" END,
                    "status" = CASE WHEN "status" = 'running' AND "done" + 1 >= "total" THEN 'completed' ELSE "status" END
                WHERE "id" = ${jobId}::uuid`;
        });
    }

    private async enqueue(jobId: string): Promise<void> {
        let cursor: string | undefined;
        for (;;) {
            const items = await this.prisma.wordSyncItem.findMany({
                where: { jobId },
                select: { wordId: true, word: true, partOfSpeech: true },
                orderBy: { wordId: 'asc' },
                take: ENQUEUE_PAGE_SIZE,
                ...(cursor && {
                    cursor: { jobId_wordId: { jobId, wordId: cursor } },
                    skip: 1,
                }),
            });
            if (items.length === 0) return;
            await this.kafka.sendBatch(
                DICTIONARY_SYNC_WORD_LANGEEK_TOPIC,
                items.map((item) => ({
                    wordId: item.wordId,
                    word: item.word,
                    partOfSpeech: item.partOfSpeech,
                    adminJobId: jobId,
                })),
            );
            if (items.length < ENQUEUE_PAGE_SIZE) return;
            cursor = items[items.length - 1].wordId;
        }
    }

    private checkScope(input: ScopeInput): void {
        const problem = scopeProblem(input);
        if (problem) throw new BadRequestException(problem);
    }

    /** What the run covers, in words, kept on the job for the history list. */
    private async label(input: ScopeInput): Promise<string> {
        switch (input.scope) {
            case 'all':
                return 'All words';
            case 'official':
                return 'All official courses';
            case 'user':
                return "A learner's courses";
            case 'words':
                return `${input.wordIds?.length ?? 0} selected words`;
            case 'course':
                return this.courseName(input.targetId!);
            case 'health': {
                if (!input.targetId) return 'Content health gaps';
                const name = await this.courseName(input.targetId);
                return `Content health gaps · ${name}`;
            }
            case 'lesson': {
                const lesson = await this.prisma.lesson.findUnique({
                    where: { id: input.targetId },
                    select: { name: true, course: { select: { name: true } } },
                });
                if (!lesson) throw new NotFoundException('Lesson not found');
                return `${lesson.course.name} › ${lesson.name}`;
            }
            case 'retry': {
                const source = await this.findJob(input.targetId!);
                return `Retry · ${source.scopeLabel}`;
            }
        }
    }

    private async courseName(id: string): Promise<string> {
        const course = await this.prisma.course.findUnique({
            where: { id },
            select: { name: true },
        });
        if (!course) throw new NotFoundException('Course not found');
        return course.name;
    }

    private async findJob(jobId: string) {
        const job = await this.prisma.wordSyncJob.findUnique({
            where: { id: jobId },
        });
        if (!job) throw new NotFoundException('Sync not found');
        return job;
    }

    private log(
        actor: string,
        action: string,
        target: string,
        details: Record<string, unknown>,
    ): void {
        this.logger.log(
            `admin_action ${JSON.stringify({ actor, action, target, ...details })}`,
        );
    }
}
