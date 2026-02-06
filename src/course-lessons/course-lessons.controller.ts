import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
} from '@nestjs/common';
import { CourseLessonsService } from './course-lessons.service';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';
import { Lesson } from '@prisma/client';

@Controller('users/:userLoginId/courses/:courseId/lessons')
export class CourseLessonsController {
    constructor(private readonly lessonsService: CourseLessonsService) {}

    @Post()
    async createLesson(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Body() createLessonDto: CreateLessonDto,
    ): Promise<Lesson> {
        return this.lessonsService.createLesson(
            userLoginId,
            courseId,
            createLessonDto,
        );
    }

    @Get(':lessonId')
    async getLessonById(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
    ): Promise<Lesson> {
        return this.lessonsService.getLessonById(
            userLoginId,
            courseId,
            lessonId,
        );
    }

    @Put(':lessonId')
    async updateLesson(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @Body() updateLessonDto: UpdateLessonDto,
    ): Promise<Lesson> {
        return this.lessonsService.updateLesson(
            userLoginId,
            courseId,
            lessonId,
            updateLessonDto,
        );
    }

    @Delete(':lessonId')
    async deleteLesson(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
    ): Promise<{ success: boolean }> {
        await this.lessonsService.deleteLesson(userLoginId, courseId, lessonId);
        return { success: true };
    }
}
