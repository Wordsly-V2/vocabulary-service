import { OFFICIAL_CACHE_PREFIX, officialCacheKeys } from '@/cache/cache-keys';
import { CacheService } from '@/cache/cache.service';
import { CacheKind } from '@/cache/cache-ttl';
import type {
    CreateWordDto,
    UpdateWordDto,
} from '@/course-lesson-words/dto/word.dto';
import type {
    CreateLessonDto,
    UpdateLessonDto,
} from '@/course-lessons/dto/lesson.dto';
import type {
    CreateCourseDto,
    UpdateCourseDto,
} from '@/courses/dto/courses.dto';
import { WORDS_DELETED_TOPIC } from '@/messaging/constants';
import { KafkaProducerService } from '@/messaging/kafka-producer.service';
import { PrismaService } from '@/prisma/prisma.service';
import type { Pagination } from '@/types/common/pagination.type';
import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Course, Lesson, Word } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import type {
    OfficialCourseCard,
    OfficialCourseDetail,
    OfficialCourseStatus,
    OfficialCourseSummary,
} from './dto/official-courses.dto';
import { copiedWord, newestCopies } from './official-courses.logic';

/** Every official-course query starts here: no owner. */
const OFFICIAL = { userLoginId: null } as const;
const PUBLISHED = { ...OFFICIAL, publishedAt: { not: null } } as const;

const LESSON_ORDER: Prisma.LessonOrderByWithRelationInput[] = [
    { orderIndex: 'asc' },
    { createdAt: 'asc' },
];

const WITH_COUNTS = {
    _count: { select: { lessons: true } },
    lessons: { select: { _count: { select: { words: true } } } },
} satisfies Prisma.CourseInclude;

const WITH_CONTENT = {
    lessons: {
        orderBy: LESSON_ORDER,
        include: { words: { orderBy: { word: 'asc' } } },
    },
} satisfies Prisma.CourseInclude;

type CourseWithCounts = Prisma.CourseGetPayload<{
    include: typeof WITH_COUNTS;
}>;

function toSummary(course: CourseWithCounts): OfficialCourseSummary {
    return {
        id: course.id,
        name: course.name,
        coverImageUrl: course.coverImageUrl,
        publishedAt: course.publishedAt,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
        totalLessonsCount: course._count.lessons,
        totalWordsCount: course.lessons.reduce(
            (sum, lesson) => sum + lesson._count.words,
            0,
        ),
    };
}

/**
 * Official courses: `Course` rows with no owner (`userLoginId` null) that
 * admins author and publish, and learners copy into their library.
 *
 * This is its own service rather than the learner ones called with `null`:
 * those take the caller's id as a `string`, and keeping it that way means no
 * learner route can ever be handed an official course. A learner's copy is an
 * ordinary course of theirs (new course, lesson and word ids), so FSRS,
 * `words_deleted` and the account purge need nothing new, and later edits here
 * never reach a copy.
 *
 * Learners read published courses through a global cache that every admin
 * write drops. Admin reads are not cached. Admin writes log `admin_action`.
 */
@Injectable()
export class OfficialCoursesService {
    private readonly logger = new Logger(OfficialCoursesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: CacheService,
        private readonly kafkaProducer: KafkaProducerService,
    ) {}

    // ── Learners ─────────────────────────────────────────────────────────

    /** Published courses, newest first, with the learner's copy of each. */
    async listPublished(
        userLoginId: string,
        page: number,
        limit: number,
        searchQuery: string,
    ): Promise<Pagination<OfficialCourseCard>> {
        const list = await this.cache.getOrSetGlobal(
            [officialCacheKeys.list(page, limit, searchQuery)],
            () => this.list(PUBLISHED, page, limit, searchQuery),
            CacheKind.Official,
        );
        const ids = list.items.map((course) => course.id);
        const copies =
            ids.length === 0
                ? []
                : await this.prisma.course.findMany({
                      where: { userLoginId, sourceCourseId: { in: ids } },
                      select: { id: true, sourceCourseId: true },
                      orderBy: { createdAt: 'desc' },
                  });
        const copyOf = newestCopies(copies);
        return {
            ...list,
            items: list.items.map((course) => ({
                ...course,
                copiedCourseId: copyOf.get(course.id) ?? null,
            })),
        };
    }

    /** A published course with its lessons and words, to look at before copying. */
    publishedCourse(courseId: string): Promise<OfficialCourseDetail> {
        return this.cache.getOrSetGlobal(
            [officialCacheKeys.course(courseId)],
            () => this.detail(courseId, PUBLISHED),
            CacheKind.Official,
        );
    }

    /**
     * Copies a published course into the learner's library in one transaction:
     * a new course, its lessons in order and every word with all its fields,
     * all with new ids. Copying the same course again makes another copy.
     */
    async copy(userLoginId: string, courseId: string): Promise<Course> {
        const course = await this.prisma.$transaction(async (tx) => {
            const source = await tx.course.findFirst({
                where: { id: courseId, ...PUBLISHED },
                include: {
                    lessons: {
                        orderBy: LESSON_ORDER,
                        include: { words: { orderBy: { createdAt: 'asc' } } },
                    },
                },
            });
            if (!source) {
                throw new NotFoundException('Course not found');
            }

            const copy = await tx.course.create({
                data: {
                    id: uuidv7(),
                    name: source.name,
                    coverImageUrl: source.coverImageUrl,
                    userLoginId,
                    sourceCourseId: source.id,
                },
            });
            const lessons = source.lessons.map((lesson, index) => ({
                lesson,
                id: uuidv7(),
                orderIndex: index + 1,
            }));
            if (lessons.length > 0) {
                await tx.lesson.createMany({
                    data: lessons.map(({ lesson, id, orderIndex }) => ({
                        id,
                        name: lesson.name,
                        coverImageUrl: lesson.coverImageUrl,
                        maxWords: lesson.maxWords,
                        orderIndex,
                        courseId: copy.id,
                    })),
                });
            }
            const words = lessons.flatMap(({ lesson, id }) =>
                lesson.words.map((word) => ({
                    ...copiedWord(word),
                    id: uuidv7(),
                    lessonId: id,
                })),
            );
            if (words.length > 0) {
                await tx.word.createMany({ data: words });
            }
            return copy;
        });
        await this.cache.invalidateUser(userLoginId);
        return course;
    }

    // ── Admins: courses ──────────────────────────────────────────────────

    /** Drafts and published courses, newest first. */
    adminList(
        page: number,
        limit: number,
        searchQuery: string,
        status?: OfficialCourseStatus,
    ): Promise<Pagination<OfficialCourseSummary>> {
        const where: Prisma.CourseWhereInput =
            status === 'published'
                ? PUBLISHED
                : status === 'draft'
                  ? { ...OFFICIAL, publishedAt: null }
                  : OFFICIAL;
        return this.list(where, page, limit, searchQuery);
    }

    adminCourse(courseId: string): Promise<OfficialCourseDetail> {
        return this.detail(courseId, OFFICIAL);
    }

    /** New courses start as drafts. */
    async createCourse(
        actorId: string,
        payload: CreateCourseDto,
    ): Promise<Course> {
        const course = await this.prisma.course.create({
            data: {
                id: uuidv7(),
                name: payload.name,
                coverImageUrl: payload.coverImageUrl,
                userLoginId: null,
            },
        });
        await this.written(actorId, 'create_official_course', {
            courseId: course.id,
        });
        return course;
    }

    async updateCourse(
        actorId: string,
        courseId: string,
        payload: UpdateCourseDto,
    ): Promise<Course> {
        await this.assertCourse(courseId);
        const course = await this.prisma.course.update({
            where: { id: courseId, ...OFFICIAL },
            data: { name: payload.name, coverImageUrl: payload.coverImageUrl },
        });
        await this.written(actorId, 'update_official_course', { courseId });
        return course;
    }

    /**
     * Publishing needs at least one word. Unpublishing hides the course from
     * the catalogue; copies learners already made stay theirs.
     */
    async setPublished(
        actorId: string,
        courseId: string,
        published: boolean,
    ): Promise<Course> {
        const current = await this.prisma.course.findFirst({
            where: { id: courseId, ...OFFICIAL },
            select: {
                publishedAt: true,
                lessons: { select: { _count: { select: { words: true } } } },
            },
        });
        if (!current) {
            throw new NotFoundException('Course not found');
        }
        const words = current.lessons.reduce(
            (sum, lesson) => sum + lesson._count.words,
            0,
        );
        if (published && words === 0) {
            throw new BadRequestException(
                'Add at least one word before publishing.',
            );
        }

        const course = await this.prisma.course.update({
            where: { id: courseId, ...OFFICIAL },
            // Publishing again keeps the first date.
            data: {
                publishedAt: published
                    ? (current.publishedAt ?? new Date())
                    : null,
            },
        });
        await this.written(
            actorId,
            published ? 'publish_official_course' : 'unpublish_official_course',
            { courseId },
        );
        return course;
    }

    /**
     * Deletes the course with its lessons and words. Learners' copies are
     * their own rows and stay. `words_deleted` still goes out for the ids,
     * like every word delete; no learner holds them, so it changes nothing.
     */
    async deleteCourse(
        actorId: string,
        courseId: string,
    ): Promise<{ success: true }> {
        await this.assertCourse(courseId);
        const ids = await this.prisma.$transaction(async (tx) => {
            // Blocks a concurrent word insert into these lessons until commit,
            // as in CoursesService.deleteCourse.
            await tx.$queryRaw(Prisma.sql`
                SELECT l."id"
                FROM "lessons" l
                JOIN "courses" c ON c."id" = l."courseId"
                WHERE c."id" = ${courseId}::uuid AND c."userLoginId" IS NULL
                FOR UPDATE OF l
            `);
            const ids = await this.deleteWordsIn(tx, {
                lesson: { course: { id: courseId, ...OFFICIAL } },
            });
            await tx.lesson.deleteMany({
                where: { course: { id: courseId, ...OFFICIAL } },
            });
            await tx.course.delete({ where: { id: courseId, ...OFFICIAL } });
            return ids;
        });
        await this.publishDeleted(ids);
        await this.written(actorId, 'delete_official_course', {
            courseId,
            words: ids.length,
        });
        return { success: true };
    }

    // ── Admins: lessons ──────────────────────────────────────────────────

    /** Added after the course's last lesson. */
    async createLesson(
        actorId: string,
        courseId: string,
        payload: CreateLessonDto,
    ): Promise<Lesson> {
        const lesson = await this.prisma.$transaction(async (tx) => {
            const course = await tx.course.findFirst({
                where: { id: courseId, ...OFFICIAL },
                select: { _count: { select: { lessons: true } } },
            });
            if (!course) {
                throw new NotFoundException('Course not found');
            }
            return tx.lesson.create({
                data: {
                    id: uuidv7(),
                    name: payload.name,
                    coverImageUrl: payload.coverImageUrl,
                    maxWords: payload.maxWords,
                    orderIndex: course._count.lessons + 1,
                    courseId,
                },
            });
        });
        await this.written(actorId, 'create_official_lesson', {
            courseId,
            lessonId: lesson.id,
        });
        return lesson;
    }

    async updateLesson(
        actorId: string,
        courseId: string,
        lessonId: string,
        payload: UpdateLessonDto,
    ): Promise<Lesson> {
        const current = await this.findLesson(courseId, lessonId);
        if (
            typeof payload.maxWords === 'number' &&
            current._count.words > payload.maxWords
        ) {
            throw new BadRequestException(
                `Lesson has ${current._count.words} words; maxWords cannot be set to ${payload.maxWords}.`,
            );
        }
        const lesson = await this.prisma.lesson.update({
            where: { id: lessonId, course: { id: courseId, ...OFFICIAL } },
            data: {
                name: payload.name,
                coverImageUrl: payload.coverImageUrl,
                maxWords: payload.maxWords,
            },
        });
        await this.written(actorId, 'update_official_lesson', {
            courseId,
            lessonId,
        });
        return lesson;
    }

    async deleteLesson(
        actorId: string,
        courseId: string,
        lessonId: string,
    ): Promise<{ success: true }> {
        await this.findLesson(courseId, lessonId);
        const ids = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw(Prisma.sql`
                SELECT l."id"
                FROM "lessons" l
                JOIN "courses" c ON c."id" = l."courseId"
                WHERE l."id" = ${lessonId}::uuid
                  AND c."id" = ${courseId}::uuid
                  AND c."userLoginId" IS NULL
                FOR UPDATE OF l
            `);
            const ids = await this.deleteWordsIn(tx, {
                lesson: { id: lessonId, course: { id: courseId, ...OFFICIAL } },
            });
            await tx.lesson.delete({
                where: { id: lessonId, course: { id: courseId, ...OFFICIAL } },
            });
            return ids;
        });
        await this.publishDeleted(ids);
        await this.written(actorId, 'delete_official_lesson', {
            courseId,
            lessonId,
            words: ids.length,
        });
        return { success: true };
    }

    // ── Admins: words ────────────────────────────────────────────────────

    async createWord(
        actorId: string,
        courseId: string,
        lessonId: string,
        payload: CreateWordDto,
    ): Promise<Word> {
        const lesson = await this.findLesson(courseId, lessonId);
        if (lesson.maxWords != null && lesson._count.words >= lesson.maxWords) {
            throw new BadRequestException(
                `Lesson allows at most ${lesson.maxWords} words.`,
            );
        }
        const word = await this.prisma.word.create({
            data: {
                id: uuidv7(),
                word: payload.word,
                meaning: payload.meaning,
                pronunciation: payload.pronunciation,
                partOfSpeech: payload.partOfSpeech,
                audioUrl: payload.audioUrl,
                imageUrl: payload.imageUrl,
                example: payload.example,
                lessonId,
            },
        });
        await this.written(actorId, 'create_official_word', {
            courseId,
            lessonId,
            wordId: word.id,
        });
        return word;
    }

    async updateWord(
        actorId: string,
        courseId: string,
        lessonId: string,
        wordId: string,
        payload: UpdateWordDto,
    ): Promise<Word> {
        const where = {
            id: wordId,
            lesson: { id: lessonId, course: { id: courseId, ...OFFICIAL } },
        };
        if (
            !(await this.prisma.word.findFirst({ where, select: { id: true } }))
        ) {
            throw new NotFoundException('Word not found');
        }
        const word = await this.prisma.word.update({
            where,
            data: { ...payload },
        });
        await this.written(actorId, 'update_official_word', {
            courseId,
            wordId,
        });
        return word;
    }

    /** Words from any lesson of the course; ids from elsewhere are ignored. */
    async deleteWords(
        actorId: string,
        courseId: string,
        wordIds: string[],
    ): Promise<{ count: number }> {
        await this.assertCourse(courseId);
        const ids =
            wordIds.length === 0
                ? []
                : await this.prisma.$transaction((tx) =>
                      this.deleteWordsIn(tx, {
                          id: { in: wordIds },
                          lesson: { course: { id: courseId, ...OFFICIAL } },
                      }),
                  );
        await this.publishDeleted(ids);
        await this.written(actorId, 'delete_official_words', {
            courseId,
            count: ids.length,
        });
        return { count: ids.length };
    }

    // ── Shared ───────────────────────────────────────────────────────────

    private async list(
        where: Prisma.CourseWhereInput,
        page: number,
        limit: number,
        searchQuery: string,
    ): Promise<Pagination<OfficialCourseSummary>> {
        const filtered: Prisma.CourseWhereInput = searchQuery
            ? {
                  ...where,
                  name: { contains: searchQuery, mode: 'insensitive' },
              }
            : where;
        const [courses, total] = await this.prisma.$transaction([
            this.prisma.course.findMany({
                where: filtered,
                orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
                include: WITH_COUNTS,
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.course.count({ where: filtered }),
        ]);
        return {
            items: courses.map(toSummary),
            totalItems: total,
            currentPageItems: courses.length,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit,
        };
    }

    private async detail(
        courseId: string,
        where: Prisma.CourseWhereInput,
    ): Promise<OfficialCourseDetail> {
        const course = await this.prisma.course.findFirst({
            where: { id: courseId, ...where },
            include: WITH_CONTENT,
        });
        if (!course) {
            throw new NotFoundException('Course not found');
        }
        return course;
    }

    private async assertCourse(courseId: string): Promise<void> {
        const course = await this.prisma.course.findFirst({
            where: { id: courseId, ...OFFICIAL },
            select: { id: true },
        });
        if (!course) {
            throw new NotFoundException('Course not found');
        }
    }

    private async findLesson(courseId: string, lessonId: string) {
        const lesson = await this.prisma.lesson.findFirst({
            where: { id: lessonId, course: { id: courseId, ...OFFICIAL } },
            select: { maxWords: true, _count: { select: { words: true } } },
        });
        if (!lesson) {
            throw new NotFoundException('Lesson not found');
        }
        return lesson;
    }

    /** Deletes the matching words and returns the ids actually removed. */
    private async deleteWordsIn(
        tx: Prisma.TransactionClient,
        where: Prisma.WordWhereInput,
    ): Promise<string[]> {
        const words = await tx.word.findMany({ where, select: { id: true } });
        const ids = words.map((word) => word.id);
        if (ids.length > 0) {
            await tx.word.deleteMany({ where: { id: { in: ids } } });
        }
        return ids;
    }

    private async publishDeleted(wordIds: string[]): Promise<void> {
        if (wordIds.length === 0) return;
        await this.kafkaProducer.send(WORDS_DELETED_TOPIC, { wordIds });
    }

    /** After every admin write: drop the learners' cached catalogue, log it. */
    private async written(
        actor: string,
        action: string,
        details: Record<string, unknown>,
    ): Promise<void> {
        await this.cache.invalidateGlobal(OFFICIAL_CACHE_PREFIX);
        this.logger.log(
            `admin_action ${JSON.stringify({ actor, action, ...details })}`,
        );
    }
}
