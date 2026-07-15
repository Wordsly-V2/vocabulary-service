import {
    ArrayMinSize,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    IsUUID,
    Min,
    MinLength,
    ValidateIf,
    ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/** Input for manually authoring a single example sentence on a word. */
export class CreateWordExampleDto {
    @ApiProperty({
        description: 'Example sentence text',
        example: 'She waved hello to her neighbour.',
    })
    @IsString()
    @IsNotEmpty()
    text: string;

    @ApiPropertyOptional({
        description: 'Translation of the example sentence',
        example: 'Cô ấy vẫy tay chào hàng xóm.',
    })
    @IsOptional()
    @IsString()
    translation?: string;

    @ApiPropertyOptional({
        description: 'Audio (TTS) URL for the example sentence',
        example: 'https://example.com/audio/example.mp3',
    })
    @IsOptional()
    @IsString()
    @ValidateIf((_, v) => v != null && v !== '')
    @IsUrl()
    audioUrl?: string;

    @ApiPropertyOptional({
        description: 'Ordering index of the example (defaults to array order)',
        example: 0,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    orderIndex?: number;
}

export class CreateWordDto {
    @ApiProperty({
        description: 'The word to add',
        example: 'hello',
        minLength: 1,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    word: string;

    @ApiProperty({
        description: 'The meaning of the word',
        example: 'used as a greeting',
        minLength: 1,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
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
        description:
            'URL to audio pronunciation (optional; empty string allowed)',
        example: 'https://example.com/audio/hello.mp3',
    })
    @IsOptional()
    @IsString()
    @ValidateIf((_, v) => v != null && v !== '')
    @IsUrl()
    audioUrl?: string;

    @IsString()
    @IsOptional()
    imageUrl?: string;

    @IsString()
    @IsOptional()
    example?: string;

    @ApiPropertyOptional({
        description: 'Example sentences for manual authoring',
        type: [CreateWordExampleDto],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateWordExampleDto)
    examples?: CreateWordExampleDto[];
}

export class UpdateWordDto {
    @ApiPropertyOptional({
        description: 'The word to update',
        example: 'hello',
        minLength: 1,
    })
    @IsOptional()
    @IsString()
    @MinLength(1)
    word?: string;

    @ApiPropertyOptional({
        description: 'The meaning of the word',
        example: 'used as a greeting',
        minLength: 1,
    })
    @IsOptional()
    @IsString()
    @MinLength(1)
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
        description:
            'URL to audio pronunciation (optional; empty string allowed)',
        example: 'https://example.com/audio/hello.mp3',
    })
    @IsOptional()
    @IsString()
    @ValidateIf((_, v) => v != null && v !== '')
    @IsUrl()
    audioUrl?: string;

    @IsString()
    @IsOptional()
    imageUrl?: string;

    @IsString()
    @IsOptional()
    example?: string;

    @ApiPropertyOptional({
        description:
            'Example sentences for manual authoring (replaces existing examples when provided)',
        type: [CreateWordExampleDto],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateWordExampleDto)
    examples?: CreateWordExampleDto[];
}

export class BulkCreateWordsDto {
    @ApiProperty({
        description: 'Array of words to create',
        type: [CreateWordDto],
    })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateWordDto)
    words: CreateWordDto[];
}

export class MoveWordDto {
    @ApiProperty({
        description: 'Target lesson ID to move the word to',
        example: 'lesson-uuid-123',
    })
    @IsUUID()
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
    @ArrayMinSize(1)
    @IsUUID(undefined, { each: true })
    wordIds: string[];

    @ApiProperty({
        description: 'Target lesson ID to move the words to',
        example: 'lesson-uuid-123',
    })
    @IsUUID()
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
    @ArrayMinSize(1)
    @IsUUID(undefined, { each: true })
    wordIds: string[];
}

/** A single example sentence attached to a word. */
export class WordExampleDto {
    @ApiProperty({
        description: 'Example ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    id: string;

    @ApiProperty({
        description: 'Example sentence text',
        example: 'She waved hello to her neighbour.',
    })
    text: string;

    @ApiPropertyOptional({
        description: 'Translation of the example sentence',
        nullable: true,
    })
    translation: string | null;

    @ApiPropertyOptional({
        description: 'Audio (TTS) URL for the example sentence',
        nullable: true,
    })
    audioUrl: string | null;

    @ApiProperty({
        description: 'Ordering index of the example',
        example: 0,
    })
    orderIndex: number;
}

export class WordResponseDto {
    @ApiProperty({
        description: 'Word ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    id: string;

    @ApiProperty({
        description: 'The word',
        example: 'hello',
    })
    word: string;

    @ApiProperty({
        description: 'The meaning of the word',
        example: 'used as a greeting',
    })
    meaning: string;

    @ApiPropertyOptional({
        description: 'Pronunciation of the word',
        example: '/həˈloʊ/',
    })
    pronunciation: string | null;

    @ApiPropertyOptional({
        description: 'Part of speech',
        example: 'interjection',
    })
    partOfSpeech: string | null;

    @ApiPropertyOptional({
        description: 'URL to audio pronunciation',
        example: 'https://example.com/audio/hello.mp3',
    })
    audioUrl: string | null;

    @ApiPropertyOptional({
        description: 'URL to word image',
        nullable: true,
    })
    imageUrl: string | null;

    @ApiPropertyOptional({
        description:
            'Legacy JSON-stringified array of example sentences (kept for compatibility)',
        nullable: true,
    })
    example: string | null;

    @ApiPropertyOptional({
        description: 'UK audio pronunciation URL (Cambridge)',
        nullable: true,
    })
    ukAudioUrl: string | null;

    @ApiPropertyOptional({
        description: 'US audio pronunciation URL (Cambridge)',
        nullable: true,
    })
    usAudioUrl: string | null;

    @ApiPropertyOptional({
        description: 'UK IPA transcription',
        nullable: true,
    })
    ukIpa: string | null;

    @ApiPropertyOptional({
        description: 'US IPA transcription',
        nullable: true,
    })
    usIpa: string | null;

    @ApiPropertyOptional({
        description: 'URL to thumbnail image',
        nullable: true,
    })
    imageThumbnailUrl: string | null;

    @ApiPropertyOptional({
        description: 'Other inflected forms of the word',
        type: [String],
        nullable: true,
    })
    wordForms: string[] | null;

    @ApiProperty({
        description: 'Example sentences attached to the word',
        type: [WordExampleDto],
    })
    examples: WordExampleDto[];

    @ApiProperty({
        description: 'Lesson ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    lessonId: string;

    @ApiProperty({
        description: 'Word creation timestamp',
        example: '2024-01-15T10:30:00Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Word last update timestamp',
        example: '2024-01-20T15:45:00Z',
    })
    updatedAt: Date;
}

export class BulkOperationResponseDto {
    @ApiProperty({
        description: 'Number of items affected',
        example: 5,
    })
    count: number;
}

export class DeleteResponseDto {
    @ApiProperty({
        description: 'Operation success status',
        example: true,
    })
    success: boolean;
}
