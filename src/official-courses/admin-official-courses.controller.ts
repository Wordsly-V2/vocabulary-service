import { CurrentUser } from '@/auth/jwt/current-user.decorator';
import { ADMIN_ROLE, Roles } from '@/auth/jwt/roles.decorator';
import {
    BulkDeleteWordsDto,
    CreateWordDto,
    UpdateWordDto,
} from '@/course-lesson-words/dto/word.dto';
import {
    CreateLessonDto,
    UpdateLessonDto,
} from '@/course-lessons/dto/lesson.dto';
import { CreateCourseDto, UpdateCourseDto } from '@/courses/dto/courses.dto';
import type { Pagination } from '@/types/common/pagination.type';
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Course, Lesson, Word } from '@prisma/client';
import {
    AdminOfficialCoursesQueryDto,
    type OfficialCourseDetail,
    type OfficialCourseSummary,
} from './dto/official-courses.dto';
import { OfficialCoursesService } from './official-courses.service';

/**
 * Authoring official courses under `/admin/vocabulary/courses`: courses with
 * no owner that learners copy once they are published. Admins only.
 */
@ApiTags('admin-official-courses')
@Roles(ADMIN_ROLE)
@Controller('admin/vocabulary/courses')
export class AdminOfficialCoursesController {
    constructor(private readonly official: OfficialCoursesService) {}

    @Get()
    @ApiOperation({
        summary: 'Official courses, drafts and published, newest first',
    })
    list(
        @Query() query: AdminOfficialCoursesQueryDto,
    ): Promise<Pagination<OfficialCourseSummary>> {
        return this.official.adminList(
            query.page ?? 1,
            query.limit ?? 20,
            query.searchQuery?.trim() ?? '',
            query.status,
        );
    }

    @Post()
    @ApiOperation({ summary: 'Create an official course (a draft)' })
    create(
        @CurrentUser() actorId: string,
        @Body() body: CreateCourseDto,
    ): Promise<Course> {
        return this.official.createCourse(actorId, body);
    }

    @Get(':courseId')
    course(
        @Param('courseId', ParseUUIDPipe) courseId: string,
    ): Promise<OfficialCourseDetail> {
        return this.official.adminCourse(courseId);
    }

    @Put(':courseId')
    update(
        @CurrentUser() actorId: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @Body() body: UpdateCourseDto,
    ): Promise<Course> {
        return this.official.updateCourse(actorId, courseId, body);
    }

    /** Learners' copies stay. */
    @Delete(':courseId')
    delete(
        @CurrentUser() actorId: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
    ): Promise<{ success: true }> {
        return this.official.deleteCourse(actorId, courseId);
    }

    /** 400 while the course has no words. */
    @Post(':courseId/publish')
    @HttpCode(200)
    publish(
        @CurrentUser() actorId: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
    ): Promise<Course> {
        return this.official.setPublished(actorId, courseId, true);
    }

    @Post(':courseId/unpublish')
    @HttpCode(200)
    unpublish(
        @CurrentUser() actorId: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
    ): Promise<Course> {
        return this.official.setPublished(actorId, courseId, false);
    }

    @Post(':courseId/lessons')
    createLesson(
        @CurrentUser() actorId: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @Body() body: CreateLessonDto,
    ): Promise<Lesson> {
        return this.official.createLesson(actorId, courseId, body);
    }

    @Put(':courseId/lessons/:lessonId')
    updateLesson(
        @CurrentUser() actorId: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @Param('lessonId', ParseUUIDPipe) lessonId: string,
        @Body() body: UpdateLessonDto,
    ): Promise<Lesson> {
        return this.official.updateLesson(actorId, courseId, lessonId, body);
    }

    @Delete(':courseId/lessons/:lessonId')
    deleteLesson(
        @CurrentUser() actorId: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @Param('lessonId', ParseUUIDPipe) lessonId: string,
    ): Promise<{ success: true }> {
        return this.official.deleteLesson(actorId, courseId, lessonId);
    }

    @Post(':courseId/lessons/:lessonId/words')
    createWord(
        @CurrentUser() actorId: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @Param('lessonId', ParseUUIDPipe) lessonId: string,
        @Body() body: CreateWordDto,
    ): Promise<Word> {
        return this.official.createWord(actorId, courseId, lessonId, body);
    }

    @Put(':courseId/lessons/:lessonId/words/:wordId')
    updateWord(
        @CurrentUser() actorId: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @Param('lessonId', ParseUUIDPipe) lessonId: string,
        @Param('wordId', ParseUUIDPipe) wordId: string,
        @Body() body: UpdateWordDto,
    ): Promise<Word> {
        return this.official.updateWord(
            actorId,
            courseId,
            lessonId,
            wordId,
            body,
        );
    }

    /** Words from any lesson of the course; one is fine too. */
    @Post(':courseId/words/delete')
    @HttpCode(200)
    deleteWords(
        @CurrentUser() actorId: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @Body() body: BulkDeleteWordsDto,
    ): Promise<{ count: number }> {
        return this.official.deleteWords(actorId, courseId, body.wordIds);
    }
}
