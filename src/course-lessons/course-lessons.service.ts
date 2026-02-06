import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Lesson } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';

@Injectable()
export class CourseLessonsService {
    constructor(private readonly prisma: PrismaService) {}

    async createLesson(
        userLoginId: string,
        courseId: string,
        payload: CreateLessonDto,
    ): Promise<Lesson> {
        // Verify course exists and belongs to user
        const course = await this.prisma.course.findUnique({
            where: {
                id: courseId,
                userLoginId: userLoginId,
            },
        });

        if (!course) {
            throw new NotFoundException('Course not found');
        }

        return this.prisma.lesson.create({
            data: {
                id: uuidv7(),
                name: payload.name,
                coverImageUrl: payload.coverImageUrl,
                maxWords: payload.maxWords,
                orderIndex: payload.orderIndex,
                courseId: courseId,
            },
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
                orderIndex: payload.orderIndex,
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
