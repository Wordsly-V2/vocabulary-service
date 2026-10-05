let nextId = 0;
jest.mock('uuid', () => ({
    v7: () => `00000000-0000-7000-8000-${String(++nextId).padStart(12, '0')}`,
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OFFICIAL_CACHE_PREFIX } from '@/cache/cache-keys';
import { WORDS_DELETED_TOPIC } from '@/messaging/constants';
import {
    COPIED_WORD_FIELDS,
    NOT_COPIED_WORD_FIELDS,
    copiedWord,
    newestCopies,
} from './official-courses.logic';
import { OfficialCoursesService } from './official-courses.service';

const ADMIN = '0190a000-0000-7000-8000-00000000000a';
const LEARNER = '0190a000-0000-7000-8000-000000000001';
const COURSE = '0190a000-0000-7000-8000-0000000000c1';

/** The first argument of a mock's nth call, typed. */
const argOf = <T>(mock: jest.Mock, call = 0): T =>
    (mock.mock.calls[call] as [T])[0];

type Row = Record<string, unknown> & { id: string };

const word = (id: string, text: string) => ({
    id,
    word: text,
    meaning: `${text} meaning`,
    pronunciation: '/x/',
    partOfSpeech: 'noun',
    audioUrl: null,
    imageUrl: null,
    example: '["An example."]',
    ukAudioUrl: 'https://a/uk.mp3',
    usAudioUrl: null,
    ukIpa: '/uk/',
    usIpa: '/us/',
    imageThumbnailUrl: null,
    lessonId: 'old-lesson',
    createdAt: new Date(),
    updatedAt: new Date(),
});

describe('official course logic', () => {
    it('copies every Word column except identity, lesson and timestamps', () => {
        const all = Object.values(Prisma.WordScalarFieldEnum).sort();
        const covered = [...COPIED_WORD_FIELDS, ...NOT_COPIED_WORD_FIELDS];
        expect([...covered].sort()).toEqual(all);
        expect(new Set(covered).size).toBe(covered.length);
    });

    it('copiedWord keeps the content and drops the rest', () => {
        const copy = copiedWord(word('w1', 'apple'));
        expect(copy).toMatchObject({ word: 'apple', ukIpa: '/uk/' });
        expect(copy).not.toHaveProperty('id');
        expect(copy).not.toHaveProperty('lessonId');
    });

    it('newestCopies keeps the first (newest) copy of each course', () => {
        const copies = newestCopies([
            { id: 'new', sourceCourseId: 'a' },
            { id: 'old', sourceCourseId: 'a' },
            { id: 'b1', sourceCourseId: 'b' },
            { id: 'own', sourceCourseId: null },
        ]);
        expect(Object.fromEntries(copies)).toEqual({ a: 'new', b: 'b1' });
    });
});

describe('OfficialCoursesService', () => {
    let course: Record<string, jest.Mock>;
    let lesson: Record<string, jest.Mock>;
    let wordTable: Record<string, jest.Mock>;
    let cache: Record<string, jest.Mock>;
    let kafka: { send: jest.Mock };
    let service: OfficialCoursesService;

    beforeEach(() => {
        nextId = 0;
        course = {
            findFirst: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn(({ data }) => Promise.resolve(data)),
            update: jest.fn(({ data }) =>
                Promise.resolve({ id: COURSE, ...data }),
            ),
            delete: jest.fn(),
        };
        lesson = {
            findFirst: jest.fn(),
            createMany: jest.fn(),
            deleteMany: jest.fn(),
            create: jest.fn(({ data }) => Promise.resolve(data)),
        };
        wordTable = {
            findMany: jest.fn().mockResolvedValue([]),
            createMany: jest.fn(),
            deleteMany: jest.fn(),
        };
        const prisma = {
            course,
            lesson,
            word: wordTable,
            $queryRaw: jest.fn(),
            $transaction: jest.fn((arg: unknown) =>
                typeof arg === 'function'
                    ? (arg as (tx: unknown) => unknown)(prisma)
                    : Promise.all(arg as Promise<unknown>[]),
            ),
        };
        cache = {
            getOrSetGlobal: jest.fn((_key, factory: () => unknown) =>
                factory(),
            ),
            invalidateGlobal: jest.fn(),
            invalidateUser: jest.fn(),
        };
        kafka = { send: jest.fn() };
        service = new OfficialCoursesService(
            prisma as never,
            cache as never,
            kafka as never,
        );
    });

    describe('copy', () => {
        it('copies a published course into the learner library with new ids, lessons renumbered', async () => {
            course.findFirst.mockResolvedValue({
                id: COURSE,
                name: 'Travel',
                coverImageUrl: null,
                lessons: [
                    {
                        id: 'L-a',
                        name: 'Airport',
                        coverImageUrl: null,
                        maxWords: 20,
                        orderIndex: 2,
                        words: [word('w1', 'gate'), word('w2', 'ticket')],
                    },
                    {
                        id: 'L-b',
                        name: 'Hotel',
                        coverImageUrl: null,
                        maxWords: null,
                        orderIndex: 5,
                        words: [word('w3', 'room')],
                    },
                ],
            });

            const copy = await service.copy(LEARNER, COURSE);

            expect(course.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        id: COURSE,
                        userLoginId: null,
                        publishedAt: { not: null },
                    },
                }),
            );
            expect(copy).toMatchObject({
                name: 'Travel',
                userLoginId: LEARNER,
                sourceCourseId: COURSE,
            });
            const lessons = argOf<{ data: Row[] }>(lesson.createMany).data;
            expect(lessons.map((l) => l.name)).toEqual(['Airport', 'Hotel']);
            expect(lessons.map((l) => l.orderIndex)).toEqual([1, 2]);
            expect(lessons.every((l) => l.courseId === copy.id)).toBe(true);

            const words = argOf<{ data: Row[] }>(wordTable.createMany).data;
            expect(words).toHaveLength(3);
            expect(words[0]).toMatchObject({
                word: 'gate',
                ukIpa: '/uk/',
                lessonId: lessons[0].id,
            });
            expect(words[2].lessonId).toBe(lessons[1].id);
            const ids = [copy.id, ...lessons, ...words].map((row) =>
                typeof row === 'string' ? row : row.id,
            );
            const old = ['w1', 'w2', 'w3', 'L-a', 'L-b', COURSE];
            expect(ids.filter((id) => old.includes(id))).toEqual([]);
            expect(cache.invalidateUser).toHaveBeenCalledWith(LEARNER);
        });

        it('404s on a draft or unknown course and writes nothing', async () => {
            course.findFirst.mockResolvedValue(null);
            await expect(service.copy(LEARNER, COURSE)).rejects.toBeInstanceOf(
                NotFoundException,
            );
            expect(course.create).not.toHaveBeenCalled();
        });
    });

    it("lists published courses with the learner's newest copy of each", async () => {
        course.findMany
            .mockResolvedValueOnce([
                {
                    id: COURSE,
                    name: 'Travel',
                    coverImageUrl: null,
                    publishedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    _count: { lessons: 2 },
                    lessons: [
                        { _count: { words: 2 } },
                        { _count: { words: 1 } },
                    ],
                },
            ])
            .mockResolvedValueOnce([{ id: 'my-copy', sourceCourseId: COURSE }]);
        course.count.mockResolvedValue(1);

        const page = await service.listPublished(LEARNER, 1, 12, '');

        expect(cache.getOrSetGlobal).toHaveBeenCalled();
        expect(page.items[0]).toMatchObject({
            totalLessonsCount: 2,
            totalWordsCount: 3,
            copiedCourseId: 'my-copy',
        });
        expect(argOf<{ where: unknown }>(course.findMany, 1).where).toEqual({
            userLoginId: LEARNER,
            sourceCourseId: { in: [COURSE] },
        });
    });

    it('filters the admin list by status', async () => {
        await service.adminList(1, 20, '', 'draft');
        await service.adminList(1, 20, '', 'published');
        await service.adminList(1, 20, '');
        const wheres = [0, 1, 2].map(
            (call) => argOf<{ where: unknown }>(course.count, call).where,
        );
        expect(wheres).toEqual([
            { userLoginId: null, publishedAt: null },
            { userLoginId: null, publishedAt: { not: null } },
            { userLoginId: null },
        ]);
    });

    describe('publishing', () => {
        it('refuses a course without words', async () => {
            course.findFirst.mockResolvedValue({
                publishedAt: null,
                lessons: [{ _count: { words: 0 } }],
            });
            await expect(
                service.setPublished(ADMIN, COURSE, true),
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(course.update).not.toHaveBeenCalled();
        });

        it('keeps the first publish date, and unpublish clears it', async () => {
            const first = new Date('2026-10-01T00:00:00Z');
            course.findFirst.mockResolvedValue({
                publishedAt: first,
                lessons: [{ _count: { words: 3 } }],
            });
            await service.setPublished(ADMIN, COURSE, true);
            await service.setPublished(ADMIN, COURSE, false);
            const data = (call: number) =>
                argOf<{ data: unknown }>(course.update, call).data;
            expect(data(0)).toEqual({ publishedAt: first });
            expect(data(1)).toEqual({ publishedAt: null });
            expect(cache.invalidateGlobal).toHaveBeenCalledWith(
                OFFICIAL_CACHE_PREFIX,
            );
        });

        it('404s on a learner-owned course', async () => {
            course.findFirst.mockResolvedValue(null);
            await expect(
                service.setPublished(ADMIN, COURSE, true),
            ).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    it('deletes a course, publishes the deleted word ids and drops the catalogue cache', async () => {
        course.findFirst.mockResolvedValue({ id: COURSE });
        wordTable.findMany.mockResolvedValue([{ id: 'w1' }, { id: 'w2' }]);

        await service.deleteCourse(ADMIN, COURSE);

        expect(course.delete).toHaveBeenCalledWith({
            where: { id: COURSE, userLoginId: null },
        });
        expect(kafka.send).toHaveBeenCalledWith(WORDS_DELETED_TOPIC, {
            wordIds: ['w1', 'w2'],
        });
        expect(cache.invalidateGlobal).toHaveBeenCalledWith(
            OFFICIAL_CACHE_PREFIX,
        );
    });

    it('refuses a word over the lesson limit', async () => {
        lesson.findFirst.mockResolvedValue({
            maxWords: 2,
            _count: { words: 2 },
        });
        await expect(
            service.createWord(ADMIN, COURSE, 'L', {
                word: 'x',
                meaning: 'y',
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });
});
