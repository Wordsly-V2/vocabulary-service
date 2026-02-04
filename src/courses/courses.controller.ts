import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Course } from '@prisma/client';
import { CoursesService } from './courses.service';
import { CreateCourse } from './dto/courses.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('user/:userLoginId')
  async getCoursesByUserLoginId(
    @Param('userLoginId') userLoginId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('orderByField') orderByField: 'createdAt' | 'name' = 'createdAt',
    @Query('orderByDirection') orderByDirection: 'asc' | 'desc' = 'asc',
  ) {
    return this.coursesService.getCoursesByUserLoginId(
      userLoginId,
      page,
      limit,
      orderByField,
      orderByDirection,
    );
  }

  @Post('user/:userLoginId')
  async createCourse(
    @Param('userLoginId') userLoginId: string,
    @Body() payload: CreateCourse,
  ) {
    return this.coursesService.createCoursesByUserLoginId(userLoginId, payload);
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
