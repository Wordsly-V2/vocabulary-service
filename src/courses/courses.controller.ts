import {
    DeleteResponseDto,
    WordResponseDto,
} from '@/course-lesson-words/dto/word.dto';
import { InternalServiceGuard } from '@/guard/internal-service/internal-service.guard';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
    UseGuards,
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
    PaginatedCourseResponseDto,
    UpdateCourseDto,
} from './dto/courses.dto';

@ApiTags('courses')
@Controller('users/:userLoginId/courses')
@UseGuards(InternalServiceGuard)
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) {}

    @Get('stats')
    @ApiOperation({
        summary: 'Get course statistics',
        description:
            'Retrieves total statistics for all courses, lessons, and words for a user',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
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
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
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
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('orderByField') orderByField: 'createdAt' | 'name' = 'createdAt',
        @Query('orderByDirection') orderByDirection: 'asc' | 'desc' = 'asc',
        @Query('searchQuery') searchQuery: string = '',
    ) {
        return this.coursesService.getCoursesByUserLoginId(
            userLoginId,
            page,
            limit,
            orderByField,
            orderByDirection,
            searchQuery,
        );
    }

    @Post()
    @ApiOperation({
        summary: 'Create a new course',
        description: 'Creates a new course for the specified user',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
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
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
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
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
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
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
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

    @Get(':courseId/words')
    @ApiOperation({
        summary: 'Get words by IDs',
        description: 'Retrieves multiple words from a course by their IDs',
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
    async getWordsByIds(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Query('ids') wordIds: string,
    ): Promise<Word[]> {
        const wordIdsArray = wordIds.split(',');
        return this.coursesService.getWordsByIds(
            userLoginId,
            courseId,
            wordIdsArray,
        );
    }
}
