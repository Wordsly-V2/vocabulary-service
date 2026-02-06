import { Course } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCourseDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    coverImageUrl?: string;
}

export class UpdateCourseDto {
    @IsOptional()
    @IsString()
    name?: string;

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
