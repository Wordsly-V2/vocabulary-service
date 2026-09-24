import { CourseLessonWordsService } from '@/course-lesson-words/course-lesson-words.service';
import { cacheKeys } from '@/cache/cache-keys';
import { CacheService } from '@/cache/cache.service';
import { CacheKind } from '@/cache/cache-ttl';
import { WORDS_DELETED_TOPIC } from '@/messaging/constants';
import { KafkaProducerService } from '@/messaging/kafka-producer.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Pagination } from '@/types/common/pagination.type';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Course, Prisma, Word } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import {
    CourseDetail,
    CoursePinState,
    CourseResponse,
    CoursesTotalStats,
    CreateCourseDto,
    UpdateCourseDto,
} from './dto/courses.dto';

@Injectable()
export class CoursesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly courseLessonWordsService: CourseLessonWordsService,
        private readonly cacheService: CacheService,
        private readonly kafkaProducer: KafkaProducerService,
    ) {}

    async getCoursesTotalStats(
        userLoginId: string,
    ): Promise<CoursesTotalStats> {
        return this.cacheService.getOrSet(
            userLoginId,
            [cacheKeys.userStats(userLoginId)],
            async () => {
                const [totalCourses, totalLessons, totalWords] =
                    await Promise.all([
                        this.prisma.course.count({
                            where: { userLoginId },
                        }),
                        this.prisma.lesson.count({
                            where: {
                                course: { userLoginId },
                            },
                        }),
                        this.prisma.word.count({
                            where: {
                                lesson: { course: { userLoginId } },
                            },
                        }),
                    ]);

                return {
                    totalCourses,
                    totalLessons,
                    totalWords,
                };
            },
            CacheKind.UserStats,
        );
    }

    async getCoursesByUserLoginId(
        userLoginId: string,
        page: number = 1,
        limit: number = 10,
        orderByField: 'createdAt' | 'name' = 'createdAt',
        orderByDirection: 'asc' | 'desc' = 'asc',
        searchQuery: string = '',
    ): Promise<Pagination<CourseResponse>> {
        return this.cacheService.getOrSet(
            userLoginId,
            [
                cacheKeys.coursesList(
                    userLoginId,
                    page,
                    limit,
                    orderByField,
                    orderByDirection,
                    searchQuery,
                ),
            ],
            async () => {
                const [courses, totalCourses] = await this.prisma.$transaction([
                    this.prisma.course.findMany({
                        where: {
                            userLoginId: userLoginId,
                            name: {
                                contains: searchQuery,
                                mode: 'insensitive',
                            },
                        },
                        // Pinned courses always lead the library, in the order
                        // they were pinned (oldest pin first); the caller's sort
                        // only orders the rest.
                        orderBy: [
                            { pinnedAt: { sort: 'asc', nulls: 'last' } },
                            { [orderByField]: orderByDirection },
                        ],
                        include: {
                            _count: {
                                select: {
                                    lessons: true,
                                },
                            },
                            lessons: {
                                orderBy: {
                                    orderIndex: 'asc',
                                },
                                include: {
                                    _count: {
                                        select: {
                                            words: true,
                                        },
                                    },
                                },
                            },
                        },
                        skip: (page - 1) * limit,
                        take: limit,
                    }),
                    this.prisma.course.count({
                        where: {
                            userLoginId: userLoginId,
                            name: {
                                contains: searchQuery,
                                mode: 'insensitive',
                            },
                        },
                    }),
                ]);

                const coursesResponse: CourseResponse[] = courses.map(
                    (course) => ({
                        id: course.id,
                        name: course.name,
                        coverImageUrl: course.coverImageUrl,
                        userLoginId: course.userLoginId,
                        isPinned: course.pinnedAt !== null,
                        totalLessonsCount: course._count.lessons,
                        totalWordsCount: course.lessons.reduce(
                            (acc, lesson) => acc + lesson._count.words,
                            0,
                        ),
                    }),
                );

                return {
                    items: coursesResponse,
                    totalItems: totalCourses,
                    currentPageItems: courses.length,
                    totalPages: Math.ceil(totalCourses / limit),
                    currentPage: page,
                    limit: limit,
                };
            },
            CacheKind.CoursesList,
        );
    }

    async createCourse(
        userLoginId: string,
        payload: CreateCourseDto,
    ): Promise<Course> {
        const course = await this.prisma.course.create({
            data: {
                id: uuidv7(),
                name: payload.name,
                coverImageUrl: payload.coverImageUrl,
                userLoginId: userLoginId,
            },
        });
        await this.cacheService.invalidateUser(userLoginId);
        return course;
    }

    async getCourseById(
        userLoginId: string,
        courseId: string,
    ): Promise<CourseDetail> {
        return this.cacheService.getOrSet(
            userLoginId,
            [cacheKeys.courseDetail(userLoginId, courseId)],
            async () => {
                const course = await this.prisma.course.findUnique({
                    where: {
                        id: courseId,
                        userLoginId,
                    },
                    include: {
                        lessons: {
                            orderBy: { orderIndex: 'asc' },
                            include: {
                                words: {
                                    orderBy: { word: 'asc' },
                                },
                            },
                        },
                    },
                });

                if (!course) {
                    throw new NotFoundException('Course not found');
                }

                return { ...course, isPinned: course.pinnedAt !== null };
            },
            CacheKind.CourseDetail,
        );
    }

    async updateCourse(
        userLoginId: string,
        courseId: string,
        payload: UpdateCourseDto,
    ): Promise<Course> {
        await this.getCourseById(userLoginId, courseId);

        const course = await this.prisma.course.update({
            where: { id: courseId, userLoginId: userLoginId },
            data: {
                name: payload.name,
                coverImageUrl: payload.coverImageUrl,
            },
        });
        await this.cacheService.invalidateUser(userLoginId);
        return course;
    }

    /**
     * Pin/unpin a course. `pinnedAt` doubles as the flag and the tie-breaker —
     * pinned courses keep the order they were pinned in, oldest pin first.
     */
    async setCoursePin(
        userLoginId: string,
        courseId: string,
        pinned: boolean,
    ): Promise<CoursePinState> {
        await this.getCourseById(userLoginId, courseId);

        const course = await this.prisma.course.update({
            where: { id: courseId, userLoginId: userLoginId },
            data: { pinnedAt: pinned ? new Date() : null },
        });
        await this.cacheService.invalidateUser(userLoginId);
        return { id: course.id, isPinned: course.pinnedAt !== null };
    }

    /**
     * Deletes a course with its lessons and words.
     *
     * Words are deleted explicitly rather than left to the FK cascade because
     * learning-service only drops progress for ids published on
     * WORDS_DELETED_TOPIC — a cascaded delete would orphan every learner's
     * progress for the course. The event goes out after commit, with the ids
     * actually deleted, so a rolled-back delete never wipes progress.
     */
    async deleteCourse(userLoginId: string, courseId: string): Promise<void> {
        await this.getCourseById(userLoginId, courseId);

        const deletedWordIds = await this.prisma.$transaction(async (tx) => {
            // Locking the lessons blocks a concurrent word insert or move into
            // them (it needs a KEY SHARE lock on the lesson row) until we commit,
            // when its FK check fails. Without it, a word added between the
            // select and the delete would be removed by the cascade unpublished.
            await tx.$queryRaw(Prisma.sql`
                SELECT l."id"
                FROM "lessons" l
                JOIN "courses" c ON c."id" = l."courseId"
                WHERE c."id" = ${courseId}::uuid
                  AND c."userLoginId" = ${userLoginId}::uuid
                FOR UPDATE OF l
            `);

            const words = await tx.word.findMany({
                where: { lesson: { course: { id: courseId, userLoginId } } },
                select: { id: true },
            });
            const ids = words.map((w) => w.id);
            if (ids.length > 0) {
                await tx.word.deleteMany({ where: { id: { in: ids } } });
            }
            await tx.lesson.deleteMany({
                where: { course: { id: courseId, userLoginId } },
            });
            await tx.course.delete({
                where: { id: courseId, userLoginId },
            });
            return ids;
        });

        if (deletedWordIds.length > 0) {
            await this.kafkaProducer.send(WORDS_DELETED_TOPIC, {
                wordIds: deletedWordIds,
            });
        }
        await this.cacheService.invalidateUser(userLoginId);
    }

    async getWords(
        userLoginId: string,
        courseId: string,
        wordIds: string[],
    ): Promise<Word[]> {
        return this.cacheService.getOrSet(
            userLoginId,
            [cacheKeys.courseWords(userLoginId, courseId, wordIds)],
            async () =>
                this.prisma.word.findMany({
                    where: {
                        id: { in: wordIds.length > 0 ? wordIds : undefined },
                        lesson: {
                            course: { userLoginId: userLoginId, id: courseId },
                        },
                    },
                    orderBy: {
                        word: 'asc',
                    },
                }),
            CacheKind.CourseWords,
        );
    }

    async deleteWordsBulkFromCourse(
        userLoginId: string,
        courseId: string,
        wordIds: string[],
    ): Promise<{ count: number }> {
        await this.getCourseById(userLoginId, courseId);
        return this.courseLessonWordsService.deleteWordsBulkFromCourse(
            userLoginId,
            courseId,
            wordIds,
        );
    }

    async moveWordsBulkFromCourse(
        userLoginId: string,
        courseId: string,
        wordIds: string[],
        targetLessonId: string,
    ): Promise<{ count: number }> {
        await this.getCourseById(userLoginId, courseId);
        return this.courseLessonWordsService.moveWordsBulkFromCourse(
            userLoginId,
            courseId,
            wordIds,
            targetLessonId,
        );
    }
}
