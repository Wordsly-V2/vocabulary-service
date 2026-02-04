import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateManyCourses } from './dto/courses.dto';
import { Course } from '@prisma/client';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('user/:userLoginId')
  async getCoursesByUserLoginId(@Param('userLoginId') userLoginId: string) {
    return this.coursesService.getCoursesByUserLoginId(userLoginId);
  }

  @Post('user/:userLoginId')
  async createCourse(
    @Param('userLoginId') userLoginId: string,
    @Body() payload: CreateManyCourses,
  ) {
    return this.coursesService.createCoursesByUserLoginId(
      userLoginId,
      payload.courses,
    );
  }

  @Get('course/:courseId')
  async getCourseById(@Param('courseId') courseId: string): Promise<Course> {
    return this.coursesService.getCourseById(courseId);
  }

  @Delete('course/:courseId')
  async deleteCourseById(
    @Param('courseId') courseId: string,
    @Body() { userLoginId }: { userLoginId: string },
  ): Promise<{ success: boolean }> {
    return this.coursesService.deleteCourseById(courseId, userLoginId);
  }
}
