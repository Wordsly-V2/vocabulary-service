import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { Course } from '@prisma/client';
import { CoursesService } from './courses.service';
import {
    CreateCourse,
    CreateCourseLesson,
    CreateWord,
} from './dto/courses.dto';

@Controller('courses')
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) {}

    @Get('user/:userLoginId/total-stats')
    async getCoursesTotalStats(@Param('userLoginId') userLoginId: string) {
        return this.coursesService.getCoursesTotalStats(userLoginId);
    }

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
        return this.coursesService.createCoursesByUserLoginId(
            userLoginId,
            payload,
        );
    }

    @Get('user/:userLoginId/course/:courseId')
    async getCourseById(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
    ): Promise<Course> {
        return this.coursesService.getCourseById(userLoginId, courseId);
    }

    @Delete('user/:userLoginId/course/:courseId')
    async deleteCourseById(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
    ): Promise<{ success: boolean }> {
        return this.coursesService.deleteCourseById(userLoginId, courseId);
    }

    @Put('user/:userLoginId/course/:courseId')
    async updateCourseById(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Body() payload: Partial<CreateCourse>,
    ): Promise<{ success: boolean }> {
        return this.coursesService.updateCourseById(
            userLoginId,
            courseId,
            payload,
        );
    }

    @Post('user/:userLoginId/course/:courseId/lessons')
    async createCourseLesson(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Body() payload: CreateCourseLesson,
    ): Promise<{ success: boolean }> {
        return this.coursesService.createCourseLesson(
            userLoginId,
            courseId,
            payload,
        );
    }

    @Put('user/:userLoginId/course/:courseId/lessons/:lessonId')
    async updateCourseLessonById(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @Body() payload: Partial<CreateCourseLesson>,
    ): Promise<{ success: boolean }> {
        return this.coursesService.updateCourseLessonById(
            userLoginId,
            courseId,
            lessonId,
            payload,
        );
    }

    @Delete('user/:userLoginId/course/:courseId/lessons/:lessonId')
    async deleteCourseLessonById(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
    ): Promise<{ success: boolean }> {
        return this.coursesService.deleteCourseLessonById(
            userLoginId,
            courseId,
            lessonId,
        );
    }

    @Post('user/:userLoginId/course/:courseId/lessons/:lessonId/words')
    async createCourseLessonWord(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @Body() payload: CreateWord,
    ): Promise<{ success: boolean }> {
        return this.coursesService.createCourseLessonWord(
            userLoginId,
            courseId,
            lessonId,
            payload,
        );
    }

    @Put('user/:userLoginId/course/:courseId/lessons/:lessonId/words/:wordId')
    async updateCourseLessonWordById(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @Param('wordId') wordId: string,
        @Body() payload: Partial<CreateWord>,
    ): Promise<{ success: boolean }> {
        return this.coursesService.updateCourseLessonWordById(
            userLoginId,
            courseId,
            lessonId,
            wordId,
            payload,
        );
    }

    @Delete(
        'user/:userLoginId/course/:courseId/lessons/:lessonId/words/:wordId',
    )
    async deleteCourseLessonWordById(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @Param('wordId') wordId: string,
    ): Promise<{ success: boolean }> {
        return this.coursesService.deleteCourseLessonWordById(
            userLoginId,
            courseId,
            lessonId,
            wordId,
        );
    }
}
