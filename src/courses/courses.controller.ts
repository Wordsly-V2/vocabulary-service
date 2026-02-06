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
import { Course, Word } from '@prisma/client';
import { CoursesService } from './courses.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/courses.dto';

@Controller('users/:userLoginId/courses')
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) {}

    // Stats endpoint
    @Get('stats')
    async getCoursesTotalStats(@Param('userLoginId') userLoginId: string) {
        return this.coursesService.getCoursesTotalStats(userLoginId);
    }

    // Courses CRUD
    @Get()
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
    async createCourse(
        @Param('userLoginId') userLoginId: string,
        @Body() createCourseDto: CreateCourseDto,
    ): Promise<Course> {
        return this.coursesService.createCourse(userLoginId, createCourseDto);
    }

    @Get(':courseId')
    async getCourseById(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
    ): Promise<Course> {
        return this.coursesService.getCourseById(userLoginId, courseId);
    }

    @Put(':courseId')
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
    async deleteCourse(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
    ): Promise<{ success: boolean }> {
        await this.coursesService.deleteCourse(userLoginId, courseId);
        return { success: true };
    }

    // Get words by IDs (course level)
    @Get(':courseId/words')
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
