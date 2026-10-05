import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type {
    CoursesTotalStats,
    CourseResponse,
} from '@/courses/dto/courses.dto';
import type { Pagination } from '@/types/common/pagination.type';

/** `GET /admin/vocabulary/users/:id/courses`. */
export interface AdminUserCourses {
    stats: CoursesTotalStats;
    courses: Pagination<CourseResponse>;
}

export class ContentHealthQueryDto {
    @ApiPropertyOptional({
        description: 'Courses listed in `worstCourses` (default 10, max 50)',
        example: 10,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number;
}

/** Words missing each kind of content. "Empty" means null or blank. */
export interface MissingCounts {
    /** No `ukIpa`, `usIpa` or `pronunciation`. */
    ipa: number;
    /** No `audioUrl`, `ukAudioUrl` or `usAudioUrl`. */
    audio: number;
    meaning: number;
    /** No example, or the empty list `[]`. */
    example: number;
    /** No `imageUrl` or `imageThumbnailUrl`. */
    image: number;
}

export interface CourseHealth {
    courseId: string;
    name: string;
    /** The owner; null for an official course (A-10). */
    userLoginId: string | null;
    words: number;
    missing: MissingCounts;
    /** Words missing IPA, audio, meaning or example (image is optional). */
    incompleteWords: number;
}

/** `GET /admin/vocabulary/health`. */
export interface ContentHealth {
    totals: {
        courses: number;
        lessons: number;
        words: number;
        /** Learners who own at least one course. */
        owners: number;
    };
    missing: MissingCounts;
    incompleteWords: number;
    /** Courses with the most incomplete words, most first. */
    worstCourses: CourseHealth[];
}
