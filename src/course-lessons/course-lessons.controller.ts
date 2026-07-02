import { DeleteResponseDto } from '@/course-lesson-words/dto/word.dto';
import { InternalServiceGuard } from '@/guard/internal-service/internal-service.guard';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
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
    LessonSummaryDto,
    ReorderLessonsDto,
    UpdateLessonDto,
} from './dto/lesson.dto';

@ApiTags('lessons')
@Controller('users/:userLoginId/courses/:courseId/lessons')
@ApiParam({
    name: 'userLoginId',
    description: 'User login ID',
    example: '01936c1e-1234-7890-abcd-ef1234567890',
})
@ApiParam({
    name: 'courseId',
    description: 'Course ID',
    example: '01936c1e-1234-7890-abcd-ef1234567890',
})
@UseGuards(InternalServiceGuard)
export class CourseLessonsController {
    constructor(private readonly lessonsService: CourseLessonsService) {}

    @Post()
    @ApiOperation({
        summary: 'Create a new lesson',
        description: 'Creates a new lesson within a course',
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
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Body() createLessonDto: CreateLessonDto,
    ): Promise<Lesson> {
        return this.lessonsService.createLesson(
            userLoginId,
            courseId,
            createLessonDto,
        );
    }

    @Put('reorder')
    @ApiOperation({
        summary: 'Re-order lessons (drag and drop)',
        description:
            'Moves one lesson to a new position. Send the dragged lesson ID and the target 1-based order index.',
    })
    @ApiBody({ type: ReorderLessonsDto })
    @ApiResponse({
        status: 200,
        description: 'Lessons re-ordered successfully',
        type: [LessonResponseDto],
    })
    @ApiResponse({
        status: 400,
        description: 'Lesson does not belong to this course',
    })
    @ApiResponse({
        status: 404,
        description: 'Course not found',
    })
    async reorderLessons(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Body() reorderLessonsDto: ReorderLessonsDto,
    ): Promise<Lesson[]> {
        return this.lessonsService.reorderLessons(
            userLoginId,
            courseId,
            reorderLessonsDto,
        );
    }

    @Get()
    @ApiOperation({
        summary: 'Get lessons by course (lightweight)',
        description:
            'Returns list of lessons for a course with word count only, no word details',
    })
    @ApiResponse({
        status: 200,
        description: 'Lessons retrieved successfully',
        type: [LessonSummaryDto],
    })
    @ApiResponse({
        status: 404,
        description: 'Course not found',
    })
    getLessonsByCourseId(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
    ): Promise<Array<Lesson & { wordsCount: number }>> {
        return this.lessonsService.getLessonsByCourseId(userLoginId, courseId);
    }

    @Get(':lessonId')
    @ApiOperation({
        summary: 'Get lesson by ID',
        description: 'Retrieves a specific lesson by its ID',
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
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
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
    @ApiResponse({
        status: 400,
        description:
            'maxWords cannot be less than the current word count in the lesson',
    })
    async updateLesson(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
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
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    ): Promise<{ success: boolean }> {
        await this.lessonsService.deleteLesson(userLoginId, courseId, lessonId);
        return { success: true };
    }
}
