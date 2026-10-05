import { CurrentUser } from '@/auth/jwt/current-user.decorator';
import {
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Course } from '@prisma/client';
import type { Pagination } from '@/types/common/pagination.type';
import {
    type OfficialCourseCard,
    type OfficialCourseDetail,
    OfficialCoursesQueryDto,
} from './dto/official-courses.dto';
import { OfficialCoursesService } from './official-courses.service';

/**
 * The catalogue of published official courses, for any signed-in learner.
 * Registered before CoursesModule (app.module.ts) so `/courses/official` is
 * matched here and not as `/courses/:courseId`.
 */
@ApiTags('official-courses')
@Controller('courses/official')
export class OfficialCoursesController {
    constructor(private readonly official: OfficialCoursesService) {}

    @Get()
    @ApiOperation({
        summary: 'Published official courses, newest first',
        description:
            'Each one says which course in your library is your copy of it (`copiedCourseId`), if any.',
    })
    list(
        @CurrentUser() userLoginId: string,
        @Query() query: OfficialCoursesQueryDto,
    ): Promise<Pagination<OfficialCourseCard>> {
        return this.official.listPublished(
            userLoginId,
            query.page ?? 1,
            query.limit ?? 12,
            query.searchQuery?.trim() ?? '',
        );
    }

    @Get(':courseId')
    @ApiOperation({ summary: 'A published course with its lessons and words' })
    course(
        @Param('courseId', ParseUUIDPipe) courseId: string,
    ): Promise<OfficialCourseDetail> {
        return this.official.publishedCourse(courseId);
    }

    @Post(':courseId/copy')
    @ApiOperation({
        summary: 'Copy a published course into your library',
        description:
            'Creates your own course, lessons and words (new ids). Later changes to the official course do not reach the copy. Returns the new course.',
    })
    copy(
        @CurrentUser() userLoginId: string,
        @Param('courseId', ParseUUIDPipe) courseId: string,
    ): Promise<Course> {
        return this.official.copy(userLoginId, courseId);
    }
}
