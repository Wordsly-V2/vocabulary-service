import { Course, Lesson, Word } from '@prisma/client';
import {
    WordProgressResponseDto,
    WordProgressStatsDto,
} from '@/word-progress/dto/word-progress.dto';
import {
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    Min,
    MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCourseDto {
    @ApiProperty({
        description: 'Name of the course',
        example: 'English Vocabulary 101',
        minLength: 1,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    name: string;

    @ApiPropertyOptional({
        description: 'URL of the course cover image',
        example: 'https://example.com/images/course-cover.jpg',
    })
    @IsOptional()
    @IsString()
    @IsUrl()
    coverImageUrl?: string;
}

export class UpdateCourseDto {
    @ApiPropertyOptional({
        description: 'Name of the course',
        example: 'English Vocabulary 101',
        minLength: 1,
    })
    @IsOptional()
    @IsString()
    @MinLength(1)
    name?: string;

    @ApiPropertyOptional({
        description: 'URL of the course cover image',
        example: 'https://example.com/images/course-cover.jpg',
    })
    @IsOptional()
    @IsString()
    @IsUrl()
    coverImageUrl?: string;
}

export class CourseResponseDto {
    @ApiProperty({
        description: 'Course ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    id: string;

    @ApiProperty({
        description: 'Course name',
        example: 'English Vocabulary 101',
    })
    name: string;

    @ApiPropertyOptional({
        description: 'URL of the course cover image',
        example: 'https://example.com/images/course-cover.jpg',
    })
    coverImageUrl: string | null;

    @ApiProperty({
        description: 'User login ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    userLoginId: string | null;

    @ApiProperty({
        description: 'Total number of lessons in the course',
        example: 10,
    })
    totalLessonsCount: number;

    @ApiProperty({
        description: 'Total number of words in the course',
        example: 250,
    })
    totalWordsCount: number;

    @ApiProperty({
        description: 'Word progress statistics for the course',
        type: WordProgressStatsDto,
    })
    wordProgressStats: WordProgressStatsDto;
}

export class CoursesTotalStatsDto {
    @ApiProperty({
        description: 'Total number of courses',
        example: 5,
    })
    totalCourses: number;

    @ApiProperty({
        description: 'Total number of lessons across all courses',
        example: 25,
    })
    totalLessons: number;

    @ApiProperty({
        description: 'Total number of words across all courses',
        example: 500,
    })
    totalWords: number;

    @ApiProperty({
        description: 'Word progress statistics across all courses',
        type: WordProgressStatsDto,
    })
    wordProgressStats: WordProgressStatsDto;
}

export class PaginatedCourseResponseDto {
    @ApiProperty({
        description: 'Array of courses',
        type: [CourseResponseDto],
    })
    items: CourseResponseDto[];

    @ApiProperty({
        description: 'Number of items in current page',
        example: 10,
    })
    currentPageItems: number;

    @ApiProperty({
        description: 'Total number of items',
        example: 45,
    })
    totalItems: number;

    @ApiProperty({
        description: 'Total number of pages',
        example: 5,
    })
    totalPages: number;

    @ApiProperty({
        description: 'Current page number',
        example: 1,
    })
    currentPage: number;

    @ApiProperty({
        description: 'Number of items per page',
        example: 10,
    })
    limit: number;
}

export class CourseDetailResponseDto {
    @ApiProperty({
        description: 'Course ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    id: string;

    @ApiProperty({
        description: 'Course name',
        example: 'English Vocabulary 101',
    })
    name: string;

    @ApiPropertyOptional({
        description: 'URL of the course cover image',
        example: 'https://example.com/images/course-cover.jpg',
    })
    coverImageUrl: string | null;

    @ApiProperty({
        description: 'User login ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    userLoginId: string | null;

    @ApiProperty({
        description: 'Course creation timestamp',
        example: '2024-01-15T10:30:00Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Course last update timestamp',
        example: '2024-01-20T15:45:00Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Lessons in the course',
        type: 'array',
    })
    lessons: any[];
}

export type CourseResponse = Omit<Course, 'createdAt' | 'updatedAt'> & {
    totalLessonsCount: number;
    totalWordsCount: number;
    wordProgressStats: WordProgressStatsDto;
};

export type CoursesTotalStats = {
    totalCourses: number;
    totalLessons: number;
    totalWords: number;
    wordProgressStats: WordProgressStatsDto;
};

/** Word with its own word-progress (for course detail). */
export type WordWithProgress = Word & {
    wordProgress: WordProgressResponseDto | null;
};

/** Lesson with words and word-progress stats (for course detail). */
export type LessonWithWordProgressStats = Lesson & {
    words: WordWithProgress[];
    wordProgressStats: WordProgressStatsDto;
};

/** Course detail with lessons and word-progress stats. */
export type CourseWithWordProgressStats = Course & {
    lessons: LessonWithWordProgressStats[];
    wordProgressStats: WordProgressStatsDto;
};

// Query DTOs for validation
export class GetCoursesQueryDto {
    @ApiPropertyOptional({
        description: 'Page number',
        example: 1,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Number of items per page',
        example: 10,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;

    @ApiPropertyOptional({
        description: 'Field to sort by',
        enum: ['createdAt', 'name'],
        example: 'createdAt',
    })
    @IsOptional()
    @IsEnum(['createdAt', 'name'])
    orderByField?: 'createdAt' | 'name' = 'createdAt';

    @ApiPropertyOptional({
        description: 'Sort direction',
        enum: ['asc', 'desc'],
        example: 'asc',
    })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    orderByDirection?: 'asc' | 'desc' = 'asc';

    @ApiPropertyOptional({
        description: 'Search query to filter courses by name',
        example: 'English',
    })
    @IsOptional()
    @IsString()
    searchQuery?: string = '';
}

export class GetWordsQueryDto {
    @ApiProperty({
        description: 'Comma-separated list of word IDs',
        example: 'word-uuid-1,word-uuid-2,word-uuid-3',
    })
    @IsString()
    @IsNotEmpty()
    ids: string;
}
