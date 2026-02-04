import { PrismaService } from '@/prisma/prisma.service';
import { Pagination } from '@/types/common/pagination.type';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Course } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { CourseResponse, CreateCourse } from './dto/courses.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCoursesByUserLoginId(
    userLoginId: string,
    page: number = 1,
    limit: number = 10,
    orderByField: 'createdAt' | 'name' = 'createdAt',
    orderByDirection: 'asc' | 'desc' = 'asc',
  ): Promise<Pagination<CourseResponse>> {
    const [courses, totalCourses] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where: {
          userLoginId: userLoginId,
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

  async getCourseById(courseId: string): Promise<Course> {
    const course: Course | null = await this.prisma.course.findUnique({
      where: {
        id: courseId,
      },
      include: {
        lessons: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }

  async deleteCourseById(
    courseId: string,
    userLoginId: string,
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
}
