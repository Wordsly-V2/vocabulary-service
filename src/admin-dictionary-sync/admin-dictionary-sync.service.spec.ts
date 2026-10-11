import {
    BadRequestException,
    ConflictException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { AdminDictionarySyncService } from './admin-dictionary-sync.service';

jest.mock('uuid', () => ({
    v7: () => '0190a000-0000-7000-8000-00000000j0b1',
}));

const ADMIN = '0190a000-0000-7000-8000-000000000001';
const JOB = '0190a000-0000-7000-8000-00000000j0b1';
const COURSE = '0190a000-0000-7000-8000-000000000c01';

/** The single argument of a mock's nth call. */
const arg = (mock: jest.Mock, n = 0): Record<string, unknown> =>
    (mock.mock.calls[n] as [Record<string, unknown>])[0];

const jobRow = (over: Record<string, unknown> = {}) => ({
    id: JOB,
    createdBy: ADMIN,
    scope: 'course',
    targetId: COURSE,
    scopeLabel: 'Animals',
    fields: ['image'],
    mode: 'fill_missing',
    status: 'running',
    retryOfId: null,
    total: 2,
    done: 0,
    updated: 0,
    skipped: 0,
    errored: 0,
    startedAt: new Date(),
    finishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
});

describe('AdminDictionarySyncService', () => {
    let tx: {
        $executeRaw: jest.Mock;
        wordSyncJob: Record<string, jest.Mock>;
        wordSyncItem: Record<string, jest.Mock>;
    };
    let prisma: Record<string, unknown> & {
        wordSyncJob: Record<string, jest.Mock>;
        wordSyncItem: Record<string, jest.Mock>;
        course: Record<string, jest.Mock>;
    };
    let kafka: { isEnabled: boolean; sendBatch: jest.Mock };
    let service: AdminDictionarySyncService;

    beforeEach(() => {
        tx = {
            // 1st call: the advisory lock; 2nd: the INSERT … SELECT (2 words).
            $executeRaw: jest
                .fn()
                .mockResolvedValueOnce(0)
                .mockResolvedValueOnce(2)
                .mockResolvedValue(1),
            wordSyncJob: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue(undefined),
                update: jest.fn().mockResolvedValue(jobRow()),
            },
            wordSyncItem: {
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        };
        prisma = {
            $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
            wordSyncJob: {
                findUnique: jest.fn().mockResolvedValue(jobRow()),
                update: jest.fn().mockResolvedValue(undefined),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            wordSyncItem: {
                findMany: jest.fn().mockResolvedValue([
                    { wordId: 'w1', word: 'cat', partOfSpeech: 'noun' },
                    { wordId: 'w2', word: 'dog', partOfSpeech: null },
                ]),
            },
            course: {
                findUnique: jest.fn().mockResolvedValue({ name: 'Animals' }),
            },
        };
        kafka = {
            isEnabled: true,
            sendBatch: jest.fn().mockResolvedValue(undefined),
        };
        service = new AdminDictionarySyncService(
            prisma as never,
            kafka as never,
            { get: () => 0 } as never,
        );
    });

    const start = () =>
        service.start(ADMIN, {
            scope: 'course',
            targetId: COURSE,
            fields: ['image', 'image'],
            mode: 'fill_missing',
        });

    it('creates the run, lists its words and enqueues one message per word', async () => {
        const job = await start();

        expect(arg(tx.wordSyncJob.create)).toMatchObject({
            data: {
                id: JOB,
                createdBy: ADMIN,
                scope: 'course',
                targetId: COURSE,
                scopeLabel: 'Animals',
                fields: ['image'],
                status: 'running',
            },
        });
        expect(tx.wordSyncJob.update).toHaveBeenCalledWith({
            where: { id: JOB },
            data: { total: 2 },
        });
        expect(kafka.sendBatch).toHaveBeenCalledWith(
            'dictionary_sync-word-langeek',
            [
                {
                    wordId: 'w1',
                    word: 'cat',
                    partOfSpeech: 'noun',
                    adminJobId: JOB,
                },
                {
                    wordId: 'w2',
                    word: 'dog',
                    partOfSpeech: null,
                    adminJobId: JOB,
                },
            ],
        );
        expect(job).toMatchObject({ id: JOB, total: 2, percent: 0 });
    });

    it('refuses without Kafka, before creating anything', async () => {
        kafka.isEnabled = false;
        await expect(start()).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses while another run is running', async () => {
        tx.wordSyncJob.findFirst.mockResolvedValue({ id: 'other' });
        await expect(start()).rejects.toBeInstanceOf(ConflictException);
        expect(tx.wordSyncJob.create).not.toHaveBeenCalled();
    });

    it('refuses a scope with no words', async () => {
        tx.$executeRaw.mockReset().mockResolvedValue(0);
        await expect(start()).rejects.toBeInstanceOf(BadRequestException);
        expect(kafka.sendBatch).not.toHaveBeenCalled();
    });

    it('refuses a scope missing its target', async () => {
        await expect(
            service.start(ADMIN, {
                scope: 'lesson',
                fields: ['image'],
                mode: 'overwrite',
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('marks the run failed when enqueueing fails', async () => {
        kafka.sendBatch.mockRejectedValue(new Error('broker gone'));
        await expect(start()).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
        const failed = arg(prisma.wordSyncJob.update);
        expect(failed).toMatchObject({
            where: { id: JOB },
            data: { status: 'failed' },
        });
        expect(
            (failed.data as { finishedAt: unknown }).finishedAt,
        ).toBeInstanceOf(Date);
    });

    describe('record', () => {
        it('marks the pending item and bumps the counters', async () => {
            await service.record(JOB, 'w1', {
                status: 'updated',
                changedFields: ['image'],
            });

            expect(arg(tx.wordSyncItem.updateMany)).toMatchObject({
                where: { jobId: JOB, wordId: 'w1', status: 'pending' },
                data: { status: 'updated', changedFields: ['image'] },
            });
            const [query] = tx.$executeRaw.mock.calls[0] as [
                { strings?: string[] } & TemplateStringsArray,
            ];
            const text = Array.from(query).join('?');
            expect(text).toContain('"done" = "done" + 1');
            expect(text).toContain("THEN 'completed'");
        });

        it('counts a redelivered word only once', async () => {
            tx.wordSyncItem.updateMany.mockResolvedValue({ count: 0 });
            await service.record(JOB, 'w1', { status: 'error', reason: 'x' });
            expect(tx.$executeRaw).not.toHaveBeenCalled();
        });
    });

    it('cancels a running run only', async () => {
        await service.cancel(ADMIN, JOB);
        expect(arg(prisma.wordSyncJob.updateMany)).toMatchObject({
            where: { id: JOB, status: 'running' },
            data: { status: 'cancelled' },
        });

        prisma.wordSyncJob.updateMany.mockResolvedValue({ count: 0 });
        await expect(service.cancel(ADMIN, JOB)).rejects.toBeInstanceOf(
            ConflictException,
        );
    });

    it('retries a finished run over its failed words, with its fields and mode', async () => {
        prisma.wordSyncJob.findUnique.mockResolvedValue(
            jobRow({
                status: 'completed',
                fields: ['meaning'],
                mode: 'overwrite',
            }),
        );
        await service.retry(ADMIN, JOB);

        expect(arg(tx.wordSyncJob.create)).toMatchObject({
            data: {
                scope: 'retry',
                targetId: JOB,
                retryOfId: JOB,
                scopeLabel: 'Retry · Animals',
                fields: ['meaning'],
                mode: 'overwrite',
            },
        });
    });

    it('does not retry a running run', async () => {
        await expect(service.retry(ADMIN, JOB)).rejects.toBeInstanceOf(
            ConflictException,
        );
    });

    it("caches a run's settings for the consumer", async () => {
        const first = await service.runSettings(JOB);
        await service.runSettings(JOB);
        expect(first).toEqual({
            fields: ['image'],
            mode: 'fill_missing',
            running: true,
        });
        expect(prisma.wordSyncJob.findUnique).toHaveBeenCalledTimes(1);
    });
});
