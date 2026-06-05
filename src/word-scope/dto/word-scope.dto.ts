import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class ScopedWordIdsQueryDto {
    @ApiPropertyOptional({
        description: 'Filter by course ID',
        example: '01936b3e-7c8f-7890-abcd-ef1234567890',
    })
    @IsOptional()
    @IsUUID()
    courseId?: string;

    @ApiPropertyOptional({
        description: 'Filter by lesson ID',
        example: '01936b3e-7c8f-7890-abcd-ef1234567890',
    })
    @IsOptional()
    @IsUUID()
    lessonId?: string;
}

export class ScopedWordIdsResponseDto {
    @ApiProperty({
        description: 'Word IDs in scope, ordered by lesson then word',
        type: [String],
    })
    wordIds: string[];
}

export class WordAccessResponseDto {
    @ApiProperty({ description: 'Whether the user owns this word' })
    hasAccess: boolean;
}

export class FilterOwnedWordIdsDto {
    @ApiProperty({ description: 'Word IDs to filter', type: [String] })
    @IsArray()
    @IsUUID(undefined, { each: true })
    wordIds: string[];
}

export class FilterOwnedWordIdsResponseDto {
    @ApiProperty({
        description: 'Subset of word IDs owned by the user',
        type: [String],
    })
    wordIds: string[];
}

export class WordScopeGroupDto {
    @ApiProperty({ description: 'Word IDs in this scope', type: [String] })
    wordIds: string[];

    @ApiProperty({ description: 'Total words in this scope' })
    totalWords: number;
}

export class ByLessonIdsDto {
    @ApiProperty({ description: 'Lesson IDs', type: [String] })
    @IsArray()
    @IsUUID(undefined, { each: true })
    lessonIds: string[];
}

export class ByCourseIdsDto {
    @ApiProperty({ description: 'Course IDs', type: [String] })
    @IsArray()
    @IsUUID(undefined, { each: true })
    courseIds: string[];
}
