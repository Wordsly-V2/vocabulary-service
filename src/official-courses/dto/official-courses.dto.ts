import { ApiPropertyOptional } from '@nestjs/swagger';
import type { Course, Lesson, Word } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** An official course is a draft until an admin publishes it. */
export const OFFICIAL_COURSE_STATUSES = ['draft', 'published'] as const;
export type OfficialCourseStatus = (typeof OFFICIAL_COURSE_STATUSES)[number];

/** Page size cap for official course lists. */
export const MAX_OFFICIAL_PAGE_SIZE = 50;

export class OfficialCoursesQueryDto {
    @ApiPropertyOptional({ example: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ example: 12, minimum: 1, maximum: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_OFFICIAL_PAGE_SIZE)
    limit?: number;

    @ApiPropertyOptional({ description: 'Filter by course name' })
    @IsOptional()
    @IsString()
    searchQuery?: string;
}

export class AdminOfficialCoursesQueryDto extends OfficialCoursesQueryDto {
    @ApiPropertyOptional({ enum: OFFICIAL_COURSE_STATUSES })
    @IsOptional()
    @IsIn(OFFICIAL_COURSE_STATUSES)
    status?: OfficialCourseStatus;
}

/** One official course in a list. */
export interface OfficialCourseSummary {
    id: string;
    name: string;
    coverImageUrl: string | null;
    /** Null while it is a draft (admin lists only; learners see published ones). */
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    totalLessonsCount: number;
    totalWordsCount: number;
}

/** A published course as a learner sees it in the catalogue. */
export interface OfficialCourseCard extends OfficialCourseSummary {
    /** The learner's newest copy of it, if they have one. */
    copiedCourseId: string | null;
}

/** One official course with its lessons (in order) and their words. */
export type OfficialCourseDetail = Course & {
    lessons: (Lesson & { words: Word[] })[];
};
