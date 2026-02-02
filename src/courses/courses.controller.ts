import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateManyCourses } from './dto/courses.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get(':userLoginId')
  async getCoursesByUserLoginId(@Param('userLoginId') userLoginId: string) {
    return this.coursesService.getCoursesByUserLoginId(userLoginId);
  }

  @Post(':userLoginId')
  async createCourse(
    @Param('userLoginId') userLoginId: string,
    @Body() payload: CreateManyCourses,
  ) {
    return this.coursesService.createCoursesByUserLoginId(
      userLoginId,
      payload.courses,
    );
  }
}
