import { CurrentUser } from '@/auth/jwt/current-user.decorator';
import { ADMIN_ROLE, Roles } from '@/auth/jwt/roles.decorator';
import {
    BulkDeleteWordsDto,
    UpdateWordDto,
} from '@/course-lesson-words/dto/word.dto';
import { UpdateLessonDto } from '@/course-lessons/dto/lesson.dto';
import {
    type CourseDetail,
    GetCoursesQueryDto,
    UpdateCourseDto,
} from '@/courses/dto/courses.dto';
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
import { AdminVocabularyService } from './admin-vocabulary.service';
import {
    type AdminUserCourses,
    type ContentHealth,
    ContentHealthQueryDto,
} from './dto/admin-vocabulary.dto';

/** Page size cap for an admin's course list (the learner route has none). */
const MAX_PAGE_SIZE = 50;

/**
 * Any learner's courses, lessons and words, and content health, under
 * `/admin/vocabulary` (the gateway routes it here). Admins only; `:id` is the
 * learner's `UserLoginId`, which UserScopeGuard lets an admin name here.
 */
@ApiTags('admin-vocabulary')
@Roles(ADMIN_ROLE)
@Controller('admin/vocabulary')
export class AdminVocabularyController {
    constructor(private readonly admin: AdminVocabularyService) {}

    @Get('health')
    @ApiOperation({
        summary: 'Words missing IPA, audio, meaning, example or image',
    })
    health(@Query() query: ContentHealthQueryDto): Promise<ContentHealth> {
        return this.admin.health(query.limit);
    }

    @Get('users/:id/courses')
    @ApiOperation({ summary: "A learner's totals and courses, newest first" })
    userCourses(
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: GetCoursesQueryDto,
    ): Promise<AdminUserCourses> {
        return this.admin.userCourses(
            id,
            query.page ?? 1,
            Math.min(query.limit ?? 10, MAX_PAGE_SIZE),
            query.searchQuery ?? '',
        );
    }

    @Get('users/:id/courses/:courseId')
    @ApiOperation({ summary: 'One course with its lessons and words' })
    course(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
    ): Promise<CourseDetail> {
        return this.admin.course(id, courseId);
    }

    @Put('users/:id/courses/:courseId')
    updateCourse(
        @CurrentUser() actorId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @Body() body: UpdateCourseDto,
    ): Promise<Course> {
        return this.admin.updateCourse(actorId, id, courseId, body);
    }

    /** Deletes its lessons and words too; learning drops their progress. */
    @Delete('users/:id/courses/:courseId')
    deleteCourse(
        @CurrentUser() actorId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
    ): Promise<{ success: true }> {
        return this.admin.deleteCourse(actorId, id, courseId);
    }

    @Put('users/:id/courses/:courseId/lessons/:lessonId')
    updateLesson(
        @CurrentUser() actorId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @Param('lessonId', ParseUUIDPipe) lessonId: string,
        @Body() body: UpdateLessonDto,
    ): Promise<Lesson> {
        return this.admin.updateLesson(actorId, id, courseId, lessonId, body);
    }

    @Delete('users/:id/courses/:courseId/lessons/:lessonId')
    deleteLesson(
        @CurrentUser() actorId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @Param('lessonId', ParseUUIDPipe) lessonId: string,
    ): Promise<{ success: true }> {
        return this.admin.deleteLesson(actorId, id, courseId, lessonId);
    }

    @Put('users/:id/courses/:courseId/lessons/:lessonId/words/:wordId')
    updateWord(
        @CurrentUser() actorId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @Param('lessonId', ParseUUIDPipe) lessonId: string,
        @Param('wordId', ParseUUIDPipe) wordId: string,
        @Body() body: UpdateWordDto,
    ): Promise<Word> {
        return this.admin.updateWord(
            actorId,
            id,
            courseId,
            lessonId,
            wordId,
            body,
        );
    }

    /** Words from any lesson of the course; one is fine too. */
    @Post('users/:id/courses/:courseId/words/delete')
    @HttpCode(200)
    deleteWords(
        @CurrentUser() actorId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @Body() body: BulkDeleteWordsDto,
    ): Promise<{ count: number }> {
        return this.admin.deleteWords(actorId, id, courseId, body.wordIds);
    }
}
