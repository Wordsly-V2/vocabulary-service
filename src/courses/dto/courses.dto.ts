import { Course } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCourseDto {
    @ApiProperty({
        description: 'Name of the course',
        example: 'English Vocabulary 101',
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({
        description: 'URL of the course cover image',
        example: 'https://example.com/images/course-cover.jpg',
    })
    @IsOptional()
    @IsString()
    coverImageUrl?: string;
}

export class UpdateCourseDto {
    @ApiPropertyOptional({
        description: 'Name of the course',
        example: 'English Vocabulary 101',
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({
        description: 'URL of the course cover image',
        example: 'https://example.com/images/course-cover.jpg',
    })
    @IsOptional()
    @IsString()
    coverImageUrl?: string;
}

export type CourseResponse = Omit<Course, 'createdAt' | 'updatedAt'> & {
    totalLessonsCount: number;
    totalWordsCount: number;
};

export type CoursesTotalStats = {
    totalCourses: number;
    totalLessons: number;
    totalWords: number;
};
