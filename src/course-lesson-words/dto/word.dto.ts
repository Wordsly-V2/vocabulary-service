import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWordDto {
    @ApiProperty({
        description: 'The word to add',
        example: 'hello',
    })
    @IsString()
    @IsNotEmpty()
    word: string;

    @ApiProperty({
        description: 'The meaning of the word',
        example: 'used as a greeting',
    })
    @IsString()
    @IsNotEmpty()
    meaning: string;

    @ApiPropertyOptional({
        description: 'Pronunciation of the word',
        example: '/həˈloʊ/',
    })
    @IsOptional()
    @IsString()
    pronunciation?: string;

    @ApiPropertyOptional({
        description: 'Part of speech',
        example: 'interjection',
    })
    @IsOptional()
    @IsString()
    partOfSpeech?: string;

    @ApiPropertyOptional({
        description: 'URL to audio pronunciation',
        example: 'https://example.com/audio/hello.mp3',
    })
    @IsOptional()
    @IsString()
    audioUrl?: string;
}

export class UpdateWordDto {
    @ApiPropertyOptional({
        description: 'The word to update',
        example: 'hello',
    })
    @IsOptional()
    @IsString()
    word?: string;

    @ApiPropertyOptional({
        description: 'The meaning of the word',
        example: 'used as a greeting',
    })
    @IsOptional()
    @IsString()
    meaning?: string;

    @ApiPropertyOptional({
        description: 'Pronunciation of the word',
        example: '/həˈloʊ/',
    })
    @IsOptional()
    @IsString()
    pronunciation?: string;

    @ApiPropertyOptional({
        description: 'Part of speech',
        example: 'interjection',
    })
    @IsOptional()
    @IsString()
    partOfSpeech?: string;

    @ApiPropertyOptional({
        description: 'URL to audio pronunciation',
        example: 'https://example.com/audio/hello.mp3',
    })
    @IsOptional()
    @IsString()
    audioUrl?: string;
}

export class BulkCreateWordsDto {
    @ApiProperty({
        description: 'Array of words to create',
        type: [CreateWordDto],
    })
    @IsArray()
    words: CreateWordDto[];
}

export class MoveWordDto {
    @ApiProperty({
        description: 'Target lesson ID to move the word to',
        example: 'lesson-uuid-123',
    })
    @IsString()
    @IsNotEmpty()
    targetLessonId: string;
}

export class BulkMoveWordsDto {
    @ApiProperty({
        description: 'Array of word IDs to move',
        example: ['word-uuid-1', 'word-uuid-2'],
        type: [String],
    })
    @IsArray()
    @IsNotEmpty()
    wordIds: string[];

    @ApiProperty({
        description: 'Target lesson ID to move the words to',
        example: 'lesson-uuid-123',
    })
    @IsString()
    @IsNotEmpty()
    targetLessonId: string;
}

export class BulkDeleteWordsDto {
    @ApiProperty({
        description: 'Array of word IDs to delete',
        example: ['word-uuid-1', 'word-uuid-2'],
        type: [String],
    })
    @IsArray()
    @IsNotEmpty()
    wordIds: string[];
}
