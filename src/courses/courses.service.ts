import { CourseLessonWordsService } from '@/course-lesson-words/course-lesson-words.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Pagination } from '@/types/common/pagination.type';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Course, Word } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import {
    CourseDetail,
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
    ) {}

    async getCoursesTotalStats(
        userLoginId: string,
    ): Promise<CoursesTotalStats> {
        const [totalCourses, totalLessons, totalWords] = await Promise.all([
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
    }

    async getCoursesByUserLoginId(
        userLoginId: string,
        page: number = 1,
        limit: number = 10,
        orderByField: 'createdAt' | 'name' = 'createdAt',
        orderByDirection: 'asc' | 'desc' = 'asc',
        searchQuery: string = '',
    ): Promise<Pagination<CourseResponse>> {
        const [courses, totalCourses] = await this.prisma.$transaction([
            this.prisma.course.findMany({
                where: {
                    userLoginId: userLoginId,
                    name: {
                        contains: searchQuery,
                        mode: 'insensitive',
                    },
                },
                orderBy: {
                    [orderByField]: orderByDirection,
                },
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

        const coursesResponse: CourseResponse[] = courses.map((course) => ({
            id: course.id,
            name: course.name,
            coverImageUrl: course.coverImageUrl,
            userLoginId: course.userLoginId,
            totalLessonsCount: course._count.lessons,
            totalWordsCount: course.lessons.reduce(
                (acc, lesson) => acc + lesson._count.words,
                0,
            ),
        }));

        return {
            items: coursesResponse,
            totalItems: totalCourses,
            currentPageItems: courses.length,
            totalPages: Math.ceil(totalCourses / limit),
            currentPage: page,
            limit: limit,
        };
    }

    async createCourse(
        userLoginId: string,
        payload: CreateCourseDto,
    ): Promise<Course> {
        return this.prisma.course.create({
            data: {
                id: uuidv7(),
                name: payload.name,
                coverImageUrl: payload.coverImageUrl,
                userLoginId: userLoginId,
            },
        });
    }

    async getCourseById(
        userLoginId: string,
        courseId: string,
    ): Promise<CourseDetail> {
        const course = await this.prisma.course.findUnique({
            where: {
                id: courseId,
                userLoginId,
            },
            include: {
                lessons: {
                    orderBy: { orderIndex: 'asc' },
                    include: {
                        words: { orderBy: { word: 'asc' } },
                    },
                },
            },
        });

        if (!course) {
            throw new NotFoundException('Course not found');
        }

        return course;
    }

    async updateCourse(
        userLoginId: string,
        courseId: string,
        payload: UpdateCourseDto,
    ): Promise<Course> {
        await this.getCourseById(userLoginId, courseId);

        return this.prisma.course.update({
            where: { id: courseId, userLoginId: userLoginId },
            data: {
                name: payload.name,
                coverImageUrl: payload.coverImageUrl,
            },
        });
    }

    async deleteCourse(userLoginId: string, courseId: string): Promise<void> {
        await this.getCourseById(userLoginId, courseId);

        await this.prisma.course.delete({
            where: {
                id: courseId,
                userLoginId: userLoginId,
            },
        });
    }

    async getWords(
        userLoginId: string,
        courseId: string,
        wordIds: string[],
    ): Promise<Word[]> {
        return this.prisma.word.findMany({
            where: {
                id: { in: wordIds.length > 0 ? wordIds : undefined },
                lesson: {
                    course: { userLoginId: userLoginId, id: courseId },
                },
            },
            orderBy: {
                word: 'asc',
            },
        });
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
