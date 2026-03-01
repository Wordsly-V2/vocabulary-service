import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Optional filters for syncing words with Langeek. All omitted = sync all words. */
export class SyncWordsLangeekDto {
    @ApiPropertyOptional({
        description: 'Filter by user (course owner)',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    @IsOptional()
    @IsUUID()
    userId?: string;

    @ApiPropertyOptional({
        description: 'Filter by course',
        example: '01936c1e-5678-7890-abcd-ef1234567890',
    })
    @IsOptional()
    @IsUUID()
    courseId?: string;

    @ApiPropertyOptional({
        description: 'Filter by lesson',
        example: '01936c1e-9abc-7890-abcd-ef1234567890',
    })
    @IsOptional()
    @IsUUID()
    lessonId?: string;

    @ApiPropertyOptional({
        description: 'Filter by single word',
        example: '01936c1e-def0-7890-abcd-ef1234567890',
    })
    @IsOptional()
    @IsUUID()
    wordId?: string;

    @ApiPropertyOptional({
        description: 'Cursor for pagination (word id). Omit for first page.',
    })
    @IsOptional()
    @IsUUID()
    cursor?: string;

    @ApiPropertyOptional({
        description: 'Page size (1–2000). Default 500.',
        minimum: 1,
        maximum: 2000,
        default: 500,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(2000)
    limit?: number;
}

/** Result item when searching user-created words across all courses. */
export class UserWordSearchResultDto {
    @ApiProperty({ example: '01936c1e-1234-7890-abcd-ef1234567890' })
    id: string;

    @ApiProperty({ example: 'accumulate' })
    word: string;

    @ApiProperty({ example: 'tích lũy, thu thập' })
    meaning: string;

    @ApiPropertyOptional({ example: 'verb', nullable: true })
    partOfSpeech: string | null;

    @ApiPropertyOptional({ description: 'URL to word image', nullable: true })
    imageUrl: string | null;

    @ApiProperty({ description: 'Lesson ID' })
    lessonId: string;

    @ApiProperty({ example: 'Unit 1' })
    lessonName: string;

    @ApiProperty({ description: 'Course ID' })
    courseId: string;

    @ApiProperty({ example: 'English 101' })
    courseName: string;
}

/** Query for searching user-created words. */
export class SearchUserWordsQueryDto {
    @ApiProperty({
        description: 'Search term (matches word or meaning, case-insensitive)',
        example: 'hello',
    })
    @IsString()
    q: string;

    @ApiPropertyOptional({
        description: 'Max number of results (1–100)',
        default: 50,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}

/** Simplified dictionary search result (public API response). */
export class DictionarySearchResultDto {
    @ApiProperty({
        description:
            'Langeek word entry ID (from api.langeek.co), used to fetch full word details',
        example: 2707,
    })
    langeekWordId: number;

    @ApiProperty({ example: 'accumulate' })
    word: string;

    @ApiProperty({ example: 'verb' })
    partOfSpeech: string;

    @ApiProperty({ example: 'tích lũy,thu thập' })
    meaning: string;

    @ApiProperty({
        description: 'URL to word image, or empty if none',
        example: 'https://cdn.langeek.co/photo/48239/original/?type=jpeg',
    })
    imageUrl: string;
}

/** Structured word details extracted from Langeek SSG JSON (pageProps.initialState.static.wordEntry). Returned by GET word-details. */
export class LangeekWordDetailsDto {
    @ApiProperty({ example: 'backward compatibility' })
    word: string;

    @ApiProperty({ example: 'tương thích ngược' })
    meaning: string;

    @ApiProperty({ example: 'noun' })
    partOfSpeech: string;

    @ApiProperty({ example: 'bˈækwɚd kəmpˌæɾɪbˈɪlɪɾi' })
    pronunciation: string;

    @ApiProperty({
        description: 'TTS audio URL for the word',
        example: 'https://tts.langeek.co/read?text=...',
    })
    audioUrl: string;

    @ApiProperty({
        type: [String],
        description: 'Example sentences in English',
        example: [
            'The PlayStation 5 has backward compatibility, so I can still play my PlayStation 4 games on it.',
        ],
    })
    examples: string[];
}

/** Word photo from Langeek API. */
export class LangeekWordPhotoDto {
    @ApiProperty()
    originalTitle: string;

    @ApiProperty({ type: [String] })
    otherTitles: string[];

    @ApiProperty()
    updatedAt: string;

    @ApiProperty()
    photoId: number;

    @ApiProperty()
    description: string;

    @ApiProperty()
    urlId: string;

    @ApiProperty()
    webTitle: string;

    @ApiProperty({ description: 'URL to full-size photo' })
    photo: string;

    @ApiProperty({ description: 'URL to thumbnail' })
    photoThumbnail: string;
}

/** Part of speech from Langeek API. */
export class LangeekPartOfSpeechDto {
    @ApiProperty({ example: 'verb' })
    partOfSpeechType: string;
}

/** Localized properties (e.g. Vietnamese translation). */
export class LangeekLocalizedPropertiesDto {
    @ApiProperty({ example: 'tích lũy,thu thập' })
    translation: string;
}

/** Single translation item (meaning + optional photo, part of speech). */
export class LangeekTranslationItemDto {
    @ApiProperty()
    id: number;

    @ApiProperty({ description: 'English definition/translation' })
    translation: string;

    @ApiPropertyOptional({ type: LangeekWordPhotoDto, nullable: true })
    wordPhoto: LangeekWordPhotoDto | null;

    @ApiPropertyOptional({ type: LangeekLocalizedPropertiesDto })
    localizedProperties?: LangeekLocalizedPropertiesDto;

    @ApiProperty()
    position: number;

    @ApiProperty({ type: LangeekPartOfSpeechDto })
    partOfSpeech: LangeekPartOfSpeechDto;
}

/** One word entry from Langeek API (one headword with its default translation). */
export class LangeekWordEntryDto {
    @ApiProperty()
    id: number;

    @ApiProperty({ example: 'accumulate' })
    entry: string;

    @ApiProperty()
    inCategory: boolean;

    @ApiProperty()
    pronunciation: string;

    @ApiProperty()
    secondPronunciation: string;

    @ApiProperty()
    withExamples: boolean;

    @ApiProperty({ type: LangeekTranslationItemDto })
    translation: LangeekTranslationItemDto;

    /** Translations grouped by part of speech (e.g. verb, noun, adjective, sentence). */
    @ApiProperty({
        type: 'object',
        additionalProperties: {
            type: 'array',
            items: { $ref: '#/components/schemas/LangeekTranslationItemDto' },
        },
    })
    translations: Record<string, LangeekTranslationItemDto[]>;

    @ApiProperty({ type: [String] })
    otherForms: string[];

    @ApiProperty({ type: [String] })
    localizedData: string[];
}
