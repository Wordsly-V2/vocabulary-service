import {
    DeleteResponseDto,
    WordResponseDto,
} from '@/course-lesson-words/dto/word.dto';
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
import {
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Course, Word } from '@prisma/client';
import { CoursesService } from './courses.service';
import {
    CourseDetailResponseDto,
    CoursesTotalStatsDto,
    CreateCourseDto,
    GetCoursesQueryDto,
    GetWordsQueryDto,
    PaginatedCourseResponseDto,
    UpdateCourseDto,
} from './dto/courses.dto';

@ApiTags('users/:userLoginId/courses')
@Controller('users/:userLoginId/courses')
@ApiParam({
    name: 'userLoginId',
    description: 'User login ID',
    example: '01936c1e-1234-7890-abcd-ef1234567890',
})
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) {}

    @Get('total-stats')
    @ApiOperation({
        summary: 'Get course statistics',
        description:
            'Retrieves total statistics for all courses, lessons, and words for a user',
    })
    @ApiResponse({
        status: 200,
        description: 'Statistics retrieved successfully',
        type: CoursesTotalStatsDto,
    })
    async getCoursesTotalStats(@Param('userLoginId') userLoginId: string) {
        return this.coursesService.getCoursesTotalStats(userLoginId);
    }

    @Get()
    @ApiOperation({
        summary: 'Get all courses for a user',
        description:
            'Retrieves paginated list of courses with filtering and sorting options',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Number of items per page',
        example: 10,
    })
    @ApiQuery({
        name: 'orderByField',
        required: false,
        enum: ['createdAt', 'name'],
        description: 'Field to sort by',
        example: 'createdAt',
    })
    @ApiQuery({
        name: 'orderByDirection',
        required: false,
        enum: ['asc', 'desc'],
        description: 'Sort direction',
        example: 'asc',
    })
    @ApiQuery({
        name: 'searchQuery',
        required: false,
        type: String,
        description: 'Search query to filter courses by name',
        example: 'English',
    })
    @ApiResponse({
        status: 200,
        description: 'Courses retrieved successfully',
        type: PaginatedCourseResponseDto,
    })
    async getCoursesByUserLoginId(
        @Param('userLoginId') userLoginId: string,
        @Query() query: GetCoursesQueryDto,
    ) {
        return this.coursesService.getCoursesByUserLoginId(
            userLoginId,
            query.page || 1,
            query.limit || 10,
            query.orderByField || 'createdAt',
            query.orderByDirection || 'asc',
            query.searchQuery || '',
        );
    }

    @Post()
    @ApiOperation({
        summary: 'Create a new course',
        description: 'Creates a new course for the specified user',
    })
    @ApiBody({ type: CreateCourseDto })
    @ApiResponse({
        status: 201,
        description: 'Course created successfully',
        type: CourseDetailResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data',
    })
    async createCourse(
        @Param('userLoginId') userLoginId: string,
        @Body() createCourseDto: CreateCourseDto,
    ): Promise<Course> {
        return this.coursesService.createCourse(userLoginId, createCourseDto);
    }

    @Get(':courseId')
    @ApiOperation({
        summary: 'Get course by ID',
        description: 'Retrieves a specific course by its ID',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiResponse({
        status: 200,
        description: 'Course retrieved successfully',
        type: CourseDetailResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Course not found',
    })
    async getCourseById(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
    ): Promise<Course> {
        return this.coursesService.getCourseById(userLoginId, courseId);
    }

    @Put(':courseId')
    @ApiOperation({
        summary: 'Update a course',
        description: 'Updates an existing course',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiBody({ type: UpdateCourseDto })
    @ApiResponse({
        status: 200,
        description: 'Course updated successfully',
        type: CourseDetailResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Course not found',
    })
    async updateCourse(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Body() updateCourseDto: UpdateCourseDto,
    ): Promise<Course> {
        return this.coursesService.updateCourse(
            userLoginId,
            courseId,
            updateCourseDto,
        );
    }

    @Delete(':courseId')
    @ApiOperation({
        summary: 'Delete a course',
        description:
            'Deletes a course and all its associated lessons and words',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiResponse({
        status: 200,
        description: 'Course deleted successfully',
        type: DeleteResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Course not found',
    })
    async deleteCourse(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
    ): Promise<{ success: boolean }> {
        await this.coursesService.deleteCourse(userLoginId, courseId);
        return { success: true };
    }

    @Delete(':courseId/words/bulk-delete')
    @ApiOperation({
        summary: 'Delete multiple words from course (any lessons)',
        description:
            'Deletes words by IDs. Words can be from any lesson in the course.',
    })
    @ApiParam({ name: 'courseId', description: 'Course ID' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['wordIds'],
            properties: {
                wordIds: {
                    type: 'array',
                    items: { type: 'string', format: 'uuid' },
                },
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Words deleted',
        schema: { type: 'object', properties: { count: { type: 'number' } } },
    })
    async deleteWordsBulkFromCourse(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Body() body: { wordIds: string[] },
    ): Promise<{ count: number }> {
        return this.coursesService.deleteWordsBulkFromCourse(
            userLoginId,
            courseId,
            body.wordIds ?? [],
        );
    }

    @Put(':courseId/words/bulk-move')
    @ApiOperation({
        summary: 'Move multiple words to a target lesson (any source lessons)',
        description:
            'Moves words by IDs to targetLessonId. Words can be from any lesson in the course.',
    })
    @ApiParam({ name: 'courseId', description: 'Course ID' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['wordIds', 'targetLessonId'],
            properties: {
                wordIds: {
                    type: 'array',
                    items: { type: 'string', format: 'uuid' },
                },
                targetLessonId: { type: 'string', format: 'uuid' },
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Words moved',
        schema: { type: 'object', properties: { count: { type: 'number' } } },
    })
    async moveWordsBulkFromCourse(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Body() body: { wordIds: string[]; targetLessonId: string },
    ): Promise<{ count: number }> {
        return this.coursesService.moveWordsBulkFromCourse(
            userLoginId,
            courseId,
            body.wordIds ?? [],
            body.targetLessonId,
        );
    }

    @Get(':courseId/words')
    @ApiOperation({
        summary: 'Get words by IDs',
        description: 'Retrieves multiple words from a course by their IDs',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiQuery({
        name: 'ids',
        description: 'Comma-separated list of word IDs',
        example: 'word-uuid-1,word-uuid-2,word-uuid-3',
    })
    @ApiResponse({
        status: 200,
        description: 'Words retrieved successfully',
        type: [WordResponseDto],
    })
    async getWords(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Query() query: GetWordsQueryDto,
    ): Promise<Word[]> {
        const wordIdsArray = query.ids.split(',').filter(Boolean);
        return this.coursesService.getWords(
            userLoginId,
            courseId,
            wordIdsArray,
        );
    }
}
