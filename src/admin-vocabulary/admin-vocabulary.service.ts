import { CourseLessonWordsService } from '@/course-lesson-words/course-lesson-words.service';
import type { UpdateWordDto } from '@/course-lesson-words/dto/word.dto';
import { CourseLessonsService } from '@/course-lessons/course-lessons.service';
import type { UpdateLessonDto } from '@/course-lessons/dto/lesson.dto';
import { CoursesService } from '@/courses/courses.service';
import type { CourseDetail, UpdateCourseDto } from '@/courses/dto/courses.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Course, Lesson, Word } from '@prisma/client';
import {
    type CourseHealthRow,
    DEFAULT_WORST_COURSES,
    type HealthRow,
    toCourseHealth,
    toMissing,
} from './admin-vocabulary.logic';
import type {
    AdminUserCourses,
    ContentHealth,
} from './dto/admin-vocabulary.dto';

/** Blank-or-null, the same test for every column the health check reads. */
const empty = (column: string) =>
    Prisma.raw(`nullif(trim(w."${column}"), '') IS NULL`);

const MISSING_IPA = Prisma.sql`(${empty('ukIpa')} AND ${empty('usIpa')} AND ${empty('pronunciation')})`;
const MISSING_AUDIO = Prisma.sql`(${empty('audioUrl')} AND ${empty('ukAudioUrl')} AND ${empty('usAudioUrl')})`;
const MISSING_MEANING = Prisma.sql`${empty('meaning')}`;
// The learner's word form saves "no examples" as the JSON `[]`.
const MISSING_EXAMPLE = Prisma.raw(
    `coalesce(nullif(trim(w."example"), ''), '[]') = '[]'`,
);
const MISSING_IMAGE = Prisma.sql`(${empty('imageUrl')} AND ${empty('imageThumbnailUrl')})`;

/** The counts every health row carries, over words aliased `w`. */
const HEALTH_COLUMNS = Prisma.sql`
    count(w."id")::int AS words,
    count(w."id") FILTER (WHERE ${MISSING_IPA})::int AS missing_ipa,
    count(w."id") FILTER (WHERE ${MISSING_AUDIO})::int AS missing_audio,
    count(w."id") FILTER (WHERE ${MISSING_MEANING})::int AS missing_meaning,
    count(w."id") FILTER (WHERE ${MISSING_EXAMPLE})::int AS missing_example,
    count(w."id") FILTER (WHERE ${MISSING_IMAGE})::int AS missing_image,
    count(w."id") FILTER (WHERE ${MISSING_IPA} OR ${MISSING_AUDIO} OR ${MISSING_MEANING} OR ${MISSING_EXAMPLE})::int AS incomplete`;

/**
 * Admin access to any learner's vocabulary under `/admin/vocabulary`.
 *
 * Every read and write goes through the learner-facing services with the
 * target's `userLoginId`, so ownership checks, cache invalidation and
 * `words_deleted` (learning-service drops the deleted words' progress) behave
 * exactly as when the learner does it themselves. Writes log one
 * `admin_action` line.
 */
@Injectable()
export class AdminVocabularyService {
    private readonly logger = new Logger(AdminVocabularyService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly courses: CoursesService,
        private readonly lessons: CourseLessonsService,
        private readonly words: CourseLessonWordsService,
    ) {}

    async userCourses(
        userLoginId: string,
        page: number,
        limit: number,
        searchQuery: string,
    ): Promise<AdminUserCourses> {
        const [stats, courses] = await Promise.all([
            this.courses.getCoursesTotalStats(userLoginId),
            this.courses.getCoursesByUserLoginId(
                userLoginId,
                page,
                limit,
                'createdAt',
                'desc',
                searchQuery,
            ),
        ]);
        return { stats, courses };
    }

    course(userLoginId: string, courseId: string): Promise<CourseDetail> {
        return this.courses.getCourseById(userLoginId, courseId);
    }

    async updateCourse(
        actorId: string,
        userLoginId: string,
        courseId: string,
        payload: UpdateCourseDto,
    ): Promise<Course> {
        const course = await this.courses.updateCourse(
            userLoginId,
            courseId,
            payload,
        );
        this.log(actorId, 'update_course', userLoginId, { courseId });
        return course;
    }

    async deleteCourse(
        actorId: string,
        userLoginId: string,
        courseId: string,
    ): Promise<{ success: true }> {
        await this.courses.deleteCourse(userLoginId, courseId);
        this.log(actorId, 'delete_course', userLoginId, { courseId });
        return { success: true };
    }

    async updateLesson(
        actorId: string,
        userLoginId: string,
        courseId: string,
        lessonId: string,
        payload: UpdateLessonDto,
    ): Promise<Lesson> {
        const lesson = await this.lessons.updateLesson(
            userLoginId,
            courseId,
            lessonId,
            payload,
        );
        this.log(actorId, 'update_lesson', userLoginId, { courseId, lessonId });
        return lesson;
    }

    async deleteLesson(
        actorId: string,
        userLoginId: string,
        courseId: string,
        lessonId: string,
    ): Promise<{ success: true }> {
        await this.lessons.deleteLesson(userLoginId, courseId, lessonId);
        this.log(actorId, 'delete_lesson', userLoginId, { courseId, lessonId });
        return { success: true };
    }

    async updateWord(
        actorId: string,
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordId: string,
        payload: UpdateWordDto,
    ): Promise<Word> {
        const word = await this.words.updateWord(
            userLoginId,
            courseId,
            lessonId,
            wordId,
            payload,
        );
        this.log(actorId, 'update_word', userLoginId, { courseId, wordId });
        return word;
    }

    async deleteWords(
        actorId: string,
        userLoginId: string,
        courseId: string,
        wordIds: string[],
    ): Promise<{ count: number }> {
        const result = await this.courses.deleteWordsBulkFromCourse(
            userLoginId,
            courseId,
            wordIds,
        );
        this.log(actorId, 'delete_words', userLoginId, {
            courseId,
            count: result.count,
        });
        return result;
    }

    /**
     * Words missing IPA, audio, meaning, example or image, over everything,
     * and the courses with the most incomplete words. One pass over `words`
     * per query; nothing is cached (admins want it fresh).
     */
    async health(limit = DEFAULT_WORST_COURSES): Promise<ContentHealth> {
        const [[overall], worst, [totals]] = await Promise.all([
            this.prisma.$queryRaw<HealthRow[]>`
                SELECT ${HEALTH_COLUMNS} FROM "words" w`,
            this.prisma.$queryRaw<CourseHealthRow[]>`
                SELECT c."id" AS course_id, c."name" AS name,
                       c."userLoginId"::text AS user_login_id, ${HEALTH_COLUMNS}
                FROM "words" w
                JOIN "lessons" l ON l."id" = w."lessonId"
                JOIN "courses" c ON c."id" = l."courseId"
                GROUP BY c."id"
                HAVING count(w."id") FILTER (WHERE ${MISSING_IPA} OR ${MISSING_AUDIO} OR ${MISSING_MEANING} OR ${MISSING_EXAMPLE}) > 0
                ORDER BY incomplete DESC, words DESC, c."id"
                LIMIT ${limit}`,
            this.prisma.$queryRaw<
                { courses: number; lessons: number; owners: number }[]
            >`
                SELECT (SELECT count(*)::int FROM "courses") AS courses,
                       (SELECT count(*)::int FROM "lessons") AS lessons,
                       (SELECT count(DISTINCT "userLoginId")::int FROM "courses") AS owners`,
        ]);

        return {
            totals: { ...totals, words: overall.words },
            missing: toMissing(overall),
            incompleteWords: overall.incomplete,
            worstCourses: worst.map(toCourseHealth),
        };
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
