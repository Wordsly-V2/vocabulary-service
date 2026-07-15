import { cacheKeys } from '@/cache/cache-keys';
import { CacheService } from '@/cache/cache.service';
import { CacheKind } from '@/cache/cache-ttl';
import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Lesson } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import {
    CreateLessonDto,
    ReorderLessonsDto,
    UpdateLessonDto,
} from './dto/lesson.dto';

@Injectable()
export class CourseLessonsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    async createLesson(
        userLoginId: string,
        courseId: string,
        payload: CreateLessonDto,
    ): Promise<Lesson> {
        const lesson = await this.prisma.$transaction(async (transaction) => {
            // Verify course exists and belongs to user
            const course = await transaction.course.findUnique({
                where: {
                    id: courseId,
                    userLoginId: userLoginId,
                },
                include: {
                    _count: {
                        select: {
                            lessons: true,
                        },
                    },
                },
            });

            if (!course) {
                throw new NotFoundException('Course not found');
            }

            return transaction.lesson.create({
                data: {
                    id: uuidv7(),
                    name: payload.name,
                    coverImageUrl: payload.coverImageUrl,
                    maxWords: payload.maxWords,
                    orderIndex: course._count.lessons + 1,
                    courseId: courseId,
                },
            });
        });
        await this.cacheService.invalidateUser(userLoginId);
        return lesson;
    }

    async reorderLessons(
        userLoginId: string,
        courseId: string,
        payload: ReorderLessonsDto,
    ): Promise<Lesson[]> {
        const lessons = await this.prisma.$transaction(async (transaction) => {
            const course = await transaction.course.findUnique({
                where: {
                    id: courseId,
                    userLoginId: userLoginId,
                },
                include: {
                    lessons: {
                        select: { id: true, orderIndex: true },
                        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
                    },
                },
            });

            if (!course) {
                throw new NotFoundException('Course not found');
            }

            const lessons = course.lessons;
            const fromIndex = lessons.findIndex(
                (l) => l.id === payload.lessonId,
            );
            if (fromIndex === -1) {
                throw new BadRequestException(
                    'Lesson does not belong to this course',
                );
            }

            const ids = lessons.map((l) => l.id);
            const [draggedId] = ids.splice(fromIndex, 1);
            const toIndex = Math.min(
                Math.max(0, payload.targetOrderIndex - 1),
                ids.length,
            );
            ids.splice(toIndex, 0, draggedId);

            const reOrderPromises = ids.map(async (id, index) => {
                return transaction.lesson.update({
                    where: {
                        id: id,
                        course: { userLoginId: userLoginId, id: courseId },
                    },
                    data: { orderIndex: index + 1 },
                });
            });
            return Promise.all(reOrderPromises);
        });
        await this.cacheService.invalidateUser(userLoginId);
        return lessons;
    }

    async getLessonsByCourseId(
        userLoginId: string,
        courseId: string,
    ): Promise<Array<Lesson & { wordsCount: number }>> {
        return this.cacheService.getOrSet(
            userLoginId,
            [cacheKeys.lessonsByCourse(userLoginId, courseId)],
            async () => {
                const course = await this.prisma.course.findUnique({
                    where: {
                        id: courseId,
                        userLoginId: userLoginId,
                    },
                    include: {
                        lessons: {
                            orderBy: [
                                { orderIndex: 'asc' },
                                { createdAt: 'asc' },
                            ],
                            include: {
                                _count: { select: { words: true } },
                            },
                        },
                    },
                });

                if (!course) {
                    throw new NotFoundException('Course not found');
                }

                return course.lessons.map(({ _count, ...lesson }) => ({
                    ...lesson,
                    wordsCount: _count.words,
                }));
            },
            CacheKind.LessonsByCourse,
        );
    }

    async getLessonById(
        userLoginId: string,
        courseId: string,
        lessonId: string,
    ): Promise<Lesson> {
        return this.cacheService.getOrSet(
            userLoginId,
            [cacheKeys.lessonDetail(userLoginId, courseId, lessonId)],
            async () => {
                const lesson = await this.prisma.lesson.findUnique({
                    where: {
                        id: lessonId,
                        course: {
                            id: courseId,
                            userLoginId: userLoginId,
                        },
                    },
                    include: {
                        words: {
                            orderBy: {
                                word: 'asc',
                            },
                            include: {
                                examples: { orderBy: { orderIndex: 'asc' } },
                            },
                        },
                    },
                });

                if (!lesson) {
                    throw new NotFoundException('Lesson not found');
                }

                return lesson;
            },
            CacheKind.LessonDetail,
        );
    }

    async updateLesson(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        payload: UpdateLessonDto,
    ): Promise<Lesson> {
        // Verify lesson exists
        await this.getLessonById(userLoginId, courseId, lessonId);

        if (typeof payload.maxWords === 'number') {
            const lesson = await this.prisma.lesson.findUnique({
                where: {
                    id: lessonId,
                    course: { userLoginId: userLoginId, id: courseId },
                },
                select: { _count: { select: { words: true } } },
            });
            if (lesson && lesson._count.words > payload.maxWords) {
                throw new BadRequestException(
                    `Lesson has ${lesson._count.words} words; maxWords cannot be set to ${payload.maxWords}.`,
                );
            }
        }

        const lesson = await this.prisma.lesson.update({
            where: {
                id: lessonId,
                course: { userLoginId: userLoginId, id: courseId },
            },
            data: {
                name: payload.name,
                coverImageUrl: payload.coverImageUrl,
                maxWords: payload.maxWords,
            },
        });
        await this.cacheService.invalidateUser(userLoginId);
        return lesson;
    }

    async deleteLesson(
        userLoginId: string,
        courseId: string,
        lessonId: string,
    ): Promise<void> {
        // Verify lesson exists
        await this.getLessonById(userLoginId, courseId, lessonId);

        await this.prisma.lesson.delete({
            where: {
                id: lessonId,
                course: { userLoginId: userLoginId, id: courseId },
            },
        });
        await this.cacheService.invalidateUser(userLoginId);
    }
}
