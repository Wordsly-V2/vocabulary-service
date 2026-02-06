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
    constructor(private readonly prisma: PrismaService) {}

    async createLesson(
        userLoginId: string,
        courseId: string,
        payload: CreateLessonDto,
    ): Promise<Lesson> {
        return await this.prisma.$transaction(async (transaction) => {
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
    }

    async reorderLessons(
        userLoginId: string,
        courseId: string,
        payload: ReorderLessonsDto,
    ): Promise<Lesson[]> {
        return await this.prisma.$transaction(async (transaction) => {
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
            const reOrderResults = await Promise.all(reOrderPromises);
            return reOrderResults;
        });
    }

    async getLessonById(
        userLoginId: string,
        courseId: string,
        lessonId: string,
    ): Promise<Lesson> {
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
                },
            },
        });

        if (!lesson) {
            throw new NotFoundException('Lesson not found');
        }

        return lesson;
    }

    async updateLesson(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        payload: UpdateLessonDto,
    ): Promise<Lesson> {
        // Verify lesson exists
        await this.getLessonById(userLoginId, courseId, lessonId);

        return this.prisma.lesson.update({
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
    }
}
