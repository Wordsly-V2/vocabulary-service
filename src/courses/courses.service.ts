import { PrismaService } from '@/prisma/prisma.service';
import { Pagination } from '@/types/common/pagination.type';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Course, Word } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import {
    CourseResponse,
    CoursesTotalStats,
    CreateCourse,
    CreateCourseLesson,
    CreateWord,
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

    async createCoursesByUserLoginId(
        userLoginId: string,
        payload: CreateCourse,
    ): Promise<{ success: boolean }> {
        await this.prisma.course.create({
            data: {
                id: uuidv7(),
                name: payload.name,
                coverImageUrl: payload.coverImageUrl,
                userLoginId: userLoginId,
            },
        });

        return {
            success: true,
        };
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

    async deleteCourseById(
        userLoginId: string,
        courseId: string,
    ): Promise<{ success: boolean }> {
        await this.prisma.course.delete({
            where: {
                id: courseId,
                userLoginId: userLoginId,
            },
        });
        return {
            success: true,
        };
    }

    async updateCourseById(
        userLoginId: string,
        courseId: string,
        payload: Partial<CreateCourse>,
    ): Promise<{ success: boolean }> {
        await this.prisma.course.update({
            where: { id: courseId, userLoginId: userLoginId },
            data: {
                name: payload.name,
                coverImageUrl: payload.coverImageUrl,
            },
        });
        return {
            success: true,
        };
    }

    async createCourseLesson(
        userLoginId: string,
        courseId: string,
        payload: CreateCourseLesson,
    ): Promise<{ success: boolean }> {
        const course = await this.getCourseById(userLoginId, courseId);
        if (!course) {
            throw new NotFoundException('Course not found');
        }

        await this.prisma.lesson.create({
            data: {
                id: uuidv7(),
                name: payload.name,
                coverImageUrl: payload.coverImageUrl,
                maxWords: payload.maxWords,
                orderIndex: payload.orderIndex,
                courseId: courseId,
            },
        });
        return {
            success: true,
        };
    }

    async updateCourseLessonById(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        payload: Partial<CreateCourseLesson>,
    ): Promise<{ success: boolean }> {
        await this.prisma.lesson.update({
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
        return {
            success: true,
        };
    }

    async deleteCourseLessonById(
        userLoginId: string,
        courseId: string,
        lessonId: string,
    ): Promise<{ success: boolean }> {
        await this.prisma.lesson.delete({
            where: {
                id: lessonId,
                course: { userLoginId: userLoginId, id: courseId },
            },
        });
        return {
            success: true,
        };
    }

    async createCourseLessonWord(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        payload: CreateWord,
    ): Promise<{ success: boolean }> {
        const lesson = await this.prisma.lesson.findUnique({
            where: {
                id: lessonId,
                course: { userLoginId: userLoginId, id: courseId },
            },
        });
        if (!lesson) {
            throw new NotFoundException('Lesson not found');
        }

        await this.prisma.word.create({
            data: {
                id: uuidv7(),
                word: payload.word,
                meaning: payload.meaning,
                pronunciation: payload.pronunciation,
                partOfSpeech: payload.partOfSpeech,
                audioUrl: payload.audioUrl,
                lessonId: lessonId,
            },
        });
        return {
            success: true,
        };
    }

    async createCourseLessonWordsBulk(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        payload: CreateWord[],
    ): Promise<{ success: boolean }> {
        const lesson = await this.prisma.lesson.findUnique({
            where: {
                id: lessonId,
                course: { userLoginId: userLoginId, id: courseId },
            },
        });
        if (!lesson) {
            throw new NotFoundException('Lesson not found');
        }

        await this.prisma.word.createMany({
            data: payload.map((word) => ({
                id: uuidv7(),
                word: word.word,
                meaning: word.meaning,
                pronunciation: word.pronunciation,
                partOfSpeech: word.partOfSpeech,
                audioUrl: word.audioUrl,
                lessonId: lessonId,
            })),
            skipDuplicates: true,
        });

        return {
            success: true,
        };
    }

    async updateCourseLessonWordById(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordId: string,
        payload: Partial<CreateWord>,
    ): Promise<{ success: boolean }> {
        await this.prisma.word.update({
            where: {
                id: wordId,
                lesson: {
                    id: lessonId,
                    course: {
                        userLoginId: userLoginId,
                        id: courseId,
                    },
                },
            },
            data: payload,
        });
        return {
            success: true,
        };
    }

    async deleteCourseLessonWordById(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordId: string,
    ): Promise<{ success: boolean }> {
        await this.prisma.word.delete({
            where: {
                id: wordId,
                lesson: {
                    id: lessonId,
                    course: {
                        userLoginId: userLoginId,
                        id: courseId,
                    },
                },
            },
        });
        return {
            success: true,
        };
    }

    async moveWordToOtherLesson(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordId: string,
        targetLessonId: string,
    ): Promise<{ success: boolean }> {
        await this.prisma.word.update({
            where: {
                id: wordId,
                lesson: {
                    id: lessonId,
                    course: { userLoginId: userLoginId, id: courseId },
                },
            },
            data: { lessonId: targetLessonId },
        });
        return {
            success: true,
        };
    }

    async moveWordsBulkToOtherLesson(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordIds: string[],
        targetLessonId: string,
    ): Promise<{ success: boolean }> {
        await this.prisma.word.updateMany({
            where: {
                id: {
                    in: wordIds,
                },
                lesson: {
                    id: lessonId,
                    course: { userLoginId: userLoginId, id: courseId },
                },
            },
            data: { lessonId: targetLessonId },
        });
        return {
            success: true,
        };
    }

    async deleteCourseLessonWordsBulk(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordIds: string[],
    ): Promise<{ success: boolean }> {
        await this.prisma.word.deleteMany({
            where: {
                id: { in: wordIds },
                lesson: {
                    id: lessonId,
                    course: { userLoginId: userLoginId, id: courseId },
                },
            },
        });
        return {
            success: true,
        };
    }

    async getWordsById(
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
