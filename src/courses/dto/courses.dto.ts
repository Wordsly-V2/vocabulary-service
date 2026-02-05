import { Course } from '@prisma/client';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCourse {
    @IsString()
    @IsNotEmpty()
    name: string;

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

export class CreateCourseLesson {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    coverImageUrl?: string;

    @IsOptional()
    @IsNumber()
    maxWords?: number;

    @IsOptional()
    @IsNumber()
    orderIndex?: number;
}

export class CreateWord {
    @IsString()
    @IsNotEmpty()
    word: string;

    @IsString()
    @IsNotEmpty()
    meaning: string;

    @IsOptional()
    @IsString()
    pronunciation?: string;

    @IsOptional()
    @IsString()
    partOfSpeech?: string;

    @IsOptional()
    @IsString()
    audioUrl?: string;
}
