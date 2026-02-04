import { Course } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
