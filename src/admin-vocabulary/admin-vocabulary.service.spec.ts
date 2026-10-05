jest.mock('uuid', () => ({ v7: () => '00000000-0000-7000-8000-000000000000' }));

import { AdminVocabularyService } from './admin-vocabulary.service';
import { toCourseHealth } from './admin-vocabulary.logic';

const ADMIN = '0190a000-0000-7000-8000-00000000000a';
const USER = '0190a000-0000-7000-8000-000000000001';
const COURSE = '0190a000-0000-7000-8000-0000000000c1';
const LESSON = '0190a000-0000-7000-8000-0000000000l1';

const healthRow = {
    words: 10,
    missing_ipa: 4,
    missing_audio: 3,
    missing_meaning: 0,
    missing_example: 6,
    missing_image: 9,
    incomplete: 7,
};

describe('AdminVocabularyService', () => {
    let courses: Record<string, jest.Mock>;
    let lessons: Record<string, jest.Mock>;
    let words: Record<string, jest.Mock>;
    let queryRaw: jest.Mock;
    let service: AdminVocabularyService;

    beforeEach(() => {
        courses = {
            getCoursesTotalStats: jest.fn().mockResolvedValue({
                totalCourses: 1,
                totalLessons: 2,
                totalWords: 3,
            }),
            getCoursesByUserLoginId: jest.fn().mockResolvedValue({ items: [] }),
            getCourseById: jest.fn().mockResolvedValue({ id: COURSE }),
            updateCourse: jest.fn().mockResolvedValue({ id: COURSE }),
            deleteCourse: jest.fn().mockResolvedValue(undefined),
            deleteWordsBulkFromCourse: jest
                .fn()
                .mockResolvedValue({ count: 2 }),
        };
        lessons = {
            updateLesson: jest.fn().mockResolvedValue({ id: LESSON }),
            deleteLesson: jest.fn().mockResolvedValue(undefined),
        };
        words = { updateWord: jest.fn().mockResolvedValue({ id: 'w' }) };
        queryRaw = jest.fn();
        service = new AdminVocabularyService(
            { $queryRaw: queryRaw } as never,
            courses as never,
            lessons as never,
            words as never,
        );
    });

    it("lists the target's courses newest first, with their totals", async () => {
        const result = await service.userCourses(USER, 2, 20, 'eng');

        expect(courses.getCoursesTotalStats).toHaveBeenCalledWith(USER);
        expect(courses.getCoursesByUserLoginId).toHaveBeenCalledWith(
            USER,
            2,
            20,
            'createdAt',
            'desc',
            'eng',
        );
        expect(result.stats.totalWords).toBe(3);
    });

    it("writes through the learner's own services, scoped to the target", async () => {
        await service.updateCourse(ADMIN, USER, COURSE, { name: 'New' });
        await service.deleteCourse(ADMIN, USER, COURSE);
        await service.updateLesson(ADMIN, USER, COURSE, LESSON, { name: 'L' });
        await service.deleteLesson(ADMIN, USER, COURSE, LESSON);
        await service.updateWord(ADMIN, USER, COURSE, LESSON, 'w', {
            meaning: 'táo',
        });

        expect(courses.updateCourse).toHaveBeenCalledWith(USER, COURSE, {
            name: 'New',
        });
        expect(courses.deleteCourse).toHaveBeenCalledWith(USER, COURSE);
        expect(lessons.updateLesson).toHaveBeenCalledWith(
            USER,
            COURSE,
            LESSON,
            {
                name: 'L',
            },
        );
        expect(lessons.deleteLesson).toHaveBeenCalledWith(USER, COURSE, LESSON);
        expect(words.updateWord).toHaveBeenCalledWith(
            USER,
            COURSE,
            LESSON,
            'w',
            { meaning: 'táo' },
        );
    });

    it('deletes words through the bulk path that publishes words_deleted', async () => {
        await expect(
            service.deleteWords(ADMIN, USER, COURSE, ['a', 'b']),
        ).resolves.toEqual({ count: 2 });
        expect(courses.deleteWordsBulkFromCourse).toHaveBeenCalledWith(
            USER,
            COURSE,
            ['a', 'b'],
        );
    });

    it('lets a not-found from the learner service through, untouched', async () => {
        const notFound = new Error('Course not found');
        courses.deleteCourse.mockRejectedValue(notFound);
        await expect(service.deleteCourse(ADMIN, USER, COURSE)).rejects.toBe(
            notFound,
        );
    });

    it('builds content health from the three queries', async () => {
        queryRaw
            .mockResolvedValueOnce([healthRow])
            .mockResolvedValueOnce([
                {
                    ...healthRow,
                    course_id: COURSE,
                    name: 'Fruit',
                    user_login_id: USER,
                },
            ])
            .mockResolvedValueOnce([{ courses: 5, lessons: 8, owners: 2 }]);

        const health = await service.health();

        expect(health).toEqual({
            totals: { courses: 5, lessons: 8, owners: 2, words: 10 },
            missing: { ipa: 4, audio: 3, meaning: 0, example: 6, image: 9 },
            incompleteWords: 7,
            worstCourses: [
                {
                    courseId: COURSE,
                    name: 'Fruit',
                    userLoginId: USER,
                    words: 10,
                    missing: {
                        ipa: 4,
                        audio: 3,
                        meaning: 0,
                        example: 6,
                        image: 9,
                    },
                    incompleteWords: 7,
                },
            ],
        });
    });
});

describe('toCourseHealth', () => {
    it('keeps a null owner (an official course)', () => {
        expect(
            toCourseHealth({
                ...healthRow,
                course_id: COURSE,
                name: 'Official',
                user_login_id: null,
            }).userLoginId,
        ).toBeNull();
    });
});
