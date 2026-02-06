import { PrismaService } from '@/prisma/prisma.service';
import { Pagination } from '@/types/common/pagination.type';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Course, Word } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import {
    CourseResponse,
    CoursesTotalStats,
    CreateCourseDto,
    UpdateCourseDto,
} from './dto/courses.dto';

@Injectable()
export class CoursesService {
    constructor(private readonly prisma: PrismaService) {}

    async getCoursesTotalStats(
        userLoginId: string,
    ): Promise<CoursesTotalStats> {
        const [totalCourses, totalLessons, totalWords] = await Promise.all([
            this.prisma.course.count({
                where: {
                    userLoginId: userLoginId,
                },
            }),
            this.prisma.lesson.count({
                where: {
                    course: {
                        userLoginId: userLoginId,
                    },
                },
            }),
            this.prisma.word.count({
                where: {
                    lesson: {
                        course: {
                            userLoginId: userLoginId,
                        },
                    },
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

        const coursesResponse = courses.map((course) => ({
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
    ): Promise<Course> {
        const course: Course | null = await this.prisma.course.findUnique({
            where: {
                id: courseId,
                userLoginId: userLoginId,
            },
            include: {
                lessons: {
                    orderBy: {
                        orderIndex: 'asc',
                    },
                    include: {
                        words: {
                            orderBy: {
                                word: 'asc',
                            },
                        },
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
        // Verify course exists
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
        // Verify course exists
        await this.getCourseById(userLoginId, courseId);

        await this.prisma.course.delete({
            where: {
                id: courseId,
                userLoginId: userLoginId,
            },
        });
    }

    async getWordsByIds(
        userLoginId: string,
        courseId: string,
        wordIds: string[],
    ): Promise<Word[]> {
        return this.prisma.word.findMany({
            where: {
                id: { in: wordIds },
                lesson: {
                    course: { userLoginId: userLoginId, id: courseId },
                },
            },
            orderBy: {
                word: 'asc',
            },
        });
    }
}
