jest.mock('uuid', () => ({ v7: () => '00000000-0000-7000-8000-000000000000' }));

import { WORDS_DELETED_TOPIC } from '@/messaging/constants';
import { CourseLessonWordsService } from './course-lesson-words.service';

describe('CourseLessonWordsService bulk delete', () => {
    const ownId = '0190a000-0000-7000-8000-000000000001';
    const foreignId = '0190a000-0000-7000-8000-000000000002';

    let tx: {
        word: { findMany: jest.Mock; deleteMany: jest.Mock };
    };
    let prisma: { $transaction: jest.Mock };
    let kafka: { send: jest.Mock };
    let cache: { invalidateUser: jest.Mock };
    let service: CourseLessonWordsService;

    beforeEach(() => {
        tx = {
            word: {
                // Ownership filter lets only the caller's word through.
                findMany: jest.fn().mockResolvedValue([{ id: ownId }]),
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        };
        prisma = {
            $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
        };
        kafka = { send: jest.fn().mockResolvedValue(undefined) };
        cache = { invalidateUser: jest.fn().mockResolvedValue(undefined) };
        service = new CourseLessonWordsService(
            prisma as never,
            cache as never,
            kafka as never,
        );
    });

    it('publishes only the ids it actually deleted from a lesson', async () => {
        const result = await service.deleteWordsBulk('user-a', 'c1', 'l1', [
            ownId,
            foreignId,
        ]);

        expect(result).toEqual({ count: 1 });
        expect(tx.word.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: [ownId] } },
        });
        expect(kafka.send).toHaveBeenCalledWith(WORDS_DELETED_TOPIC, {
            wordIds: [ownId],
        });
    });

    it('publishes only the ids it actually deleted from a course', async () => {
        await service.deleteWordsBulkFromCourse('user-a', 'c1', [
            ownId,
            foreignId,
        ]);

        expect(kafka.send).toHaveBeenCalledWith(WORDS_DELETED_TOPIC, {
            wordIds: [ownId],
        });
    });

    it('publishes nothing when none of the ids are owned', async () => {
        tx.word.findMany.mockResolvedValue([]);

        const result = await service.deleteWordsBulk('user-a', 'c1', 'l1', [
            foreignId,
        ]);

        expect(result).toEqual({ count: 0 });
        expect(tx.word.deleteMany).not.toHaveBeenCalled();
        expect(kafka.send).not.toHaveBeenCalled();
    });
});
