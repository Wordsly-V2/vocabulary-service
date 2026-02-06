import { DeleteResponseDto } from '@/course-lesson-words/dto/word.dto';
import { InternalServiceGuard } from '@/guard/internal-service/internal-service.guard';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Lesson } from '@prisma/client';
import { CourseLessonsService } from './course-lessons.service';
import {
    CreateLessonDto,
    LessonResponseDto,
    UpdateLessonDto,
} from './dto/lesson.dto';

@ApiTags('lessons')
@Controller('users/:userLoginId/courses/:courseId/lessons')
@UseGuards(InternalServiceGuard)
export class CourseLessonsController {
    constructor(private readonly lessonsService: CourseLessonsService) {}

    @Post()
    @ApiOperation({
        summary: 'Create a new lesson',
        description: 'Creates a new lesson within a course',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiBody({ type: CreateLessonDto })
    @ApiResponse({
        status: 201,
        description: 'Lesson created successfully',
        type: LessonResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data',
    })
    @ApiResponse({
        status: 404,
        description: 'Course not found',
    })
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
    @ApiOperation({
        summary: 'Get lesson by ID',
        description: 'Retrieves a specific lesson by its ID',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiParam({
        name: 'lessonId',
        description: 'Lesson ID',
        example: 'lesson-uuid-123',
    })
    @ApiResponse({
        status: 200,
        description: 'Lesson retrieved successfully',
        type: LessonResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Lesson not found',
    })
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
    @ApiOperation({
        summary: 'Update a lesson',
        description: 'Updates an existing lesson',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiParam({
        name: 'lessonId',
        description: 'Lesson ID',
        example: 'lesson-uuid-123',
    })
    @ApiBody({ type: UpdateLessonDto })
    @ApiResponse({
        status: 200,
        description: 'Lesson updated successfully',
        type: LessonResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Lesson not found',
    })
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
    @ApiOperation({
        summary: 'Delete a lesson',
        description: 'Deletes a lesson and all its associated words',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiParam({
        name: 'lessonId',
        description: 'Lesson ID',
        example: 'lesson-uuid-123',
    })
    @ApiResponse({
        status: 200,
        description: 'Lesson deleted successfully',
        type: DeleteResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Lesson not found',
    })
    async deleteLesson(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
    ): Promise<{ success: boolean }> {
        await this.lessonsService.deleteLesson(userLoginId, courseId, lessonId);
        return { success: true };
    }
}
