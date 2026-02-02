import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Course } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { CreateCourse } from './dto/courses.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCoursesByUserLoginId(userLoginId: string): Promise<Course[]> {
    const courses: Course[] = await this.prisma.course.findMany({
      where: {
        userLoginId: userLoginId,
      },
    });

    return courses;
  }

  async createCoursesByUserLoginId(
    userLoginId: string,
    courses: CreateCourse[],
  ): Promise<{ success: boolean }> {
    const coursesData = courses.map((course) => ({
      id: uuidv7(),
      name: course.name,
      coverImageUrl: course.coverImageUrl,
      userLoginId: userLoginId,
    }));

    await this.prisma.course.createMany({
      data: coursesData,
    });

    return {
      success: true,
    };
  }
}
