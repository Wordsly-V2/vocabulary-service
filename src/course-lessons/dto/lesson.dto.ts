import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    IsUUID,
    Min,
    MinLength,
} from 'class-validator';

export class CreateLessonDto {
    @ApiProperty({
        description: 'Name of the lesson',
        example: 'Basic Greetings',
        minLength: 1,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    name: string;

    @ApiPropertyOptional({
        description: 'URL of the lesson cover image',
        example: 'https://example.com/images/lesson-cover.jpg',
    })
    @IsOptional()
    @IsString()
    @IsUrl()
    coverImageUrl?: string;

    @ApiPropertyOptional({
        description: 'Maximum number of words in the lesson',
        example: 50,
        minimum: 1,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    maxWords?: number;
}

export class ReorderLessonsDto {
    @ApiProperty({
        description: 'ID of the lesson that was dragged',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    @IsUUID()
    @IsNotEmpty()
    lessonId: string;

    @ApiProperty({
        description:
            'Target position (1-based). The dragged lesson will be placed at this order index.',
        example: 3,
        minimum: 1,
    })
    @IsInt()
    @Min(1)
    targetOrderIndex: number;
}

export class UpdateLessonDto {
    @ApiPropertyOptional({
        description: 'Name of the lesson',
        example: 'Basic Greetings',
        minLength: 1,
    })
    @IsOptional()
    @IsString()
    @MinLength(1)
    name?: string;

    @ApiPropertyOptional({
        description: 'URL of the lesson cover image',
        example: 'https://example.com/images/lesson-cover.jpg',
    })
    @IsOptional()
    @IsString()
    @IsUrl()
    coverImageUrl?: string;

    @ApiPropertyOptional({
        description: 'Maximum number of words in the lesson',
        example: 50,
        minimum: 1,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    maxWords?: number;
}

export class LessonResponseDto {
    @ApiProperty({
        description: 'Lesson ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    id: string;

    @ApiProperty({
        description: 'Lesson name',
        example: 'Basic Greetings',
    })
    name: string;

    @ApiPropertyOptional({
        description: 'URL of the lesson cover image',
        example: 'https://example.com/images/lesson-cover.jpg',
    })
    coverImageUrl: string | null;

    @ApiPropertyOptional({
        description: 'Maximum number of words in the lesson',
        example: 50,
    })
    maxWords: number | null;

    @ApiPropertyOptional({
        description: 'Order index for sorting lessons',
        example: 1,
    })
    orderIndex: number | null;

    @ApiProperty({
        description: 'Course ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    courseId: string;

    @ApiProperty({
        description: 'Lesson creation timestamp',
        example: '2024-01-15T10:30:00Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Lesson last update timestamp',
        example: '2024-01-20T15:45:00Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Words in the lesson',
        type: 'array',
        required: false,
    })
    words?: any[];
}
