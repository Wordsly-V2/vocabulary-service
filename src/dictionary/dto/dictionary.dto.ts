import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Optional filters a caller may send when syncing words with Langeek. All
 * omitted = sync all of *this caller's* words.
 *
 * Note what is absent: there is no `userId`. The owner is not something a
 * request gets to choose — it comes from the access token, and the controller
 * adds it on the way through (see `SyncWordsLangeekFilters`).
 */
export class SyncWordsLangeekDto {
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

/** Lifecycle status of a word sync job. */
export type SyncJobStatus = 'in_progress' | 'completed';

/** Response after creating a sync job (returns the job id and total word count). */
export class CreateSyncJobResponseDto {
    @ApiProperty({ description: 'Sync job identifier used to poll progress' })
    jobId: string;

    @ApiProperty({
        description: 'Total number of words that will be processed',
    })
    total: number;

    @ApiProperty({
        enum: ['in_progress', 'completed'],
        description: 'completed immediately when there are no words to sync',
    })
    status: 'in_progress' | 'completed';
}

/** Progress snapshot for a sync job. */
export class SyncJobStatusDto {
    @ApiProperty()
    jobId: string;

    @ApiProperty({ enum: ['in_progress', 'completed'] })
    status: 'in_progress' | 'completed';

    @ApiProperty({ description: 'Total words in the job' })
    total: number;

    @ApiProperty({
        description: 'Words processed so far (updated + skipped + errored)',
    })
    done: number;

    @ApiProperty({ description: 'Words still to process' })
    remaining: number;

    @ApiProperty({ description: 'Words successfully updated' })
    updated: number;

    @ApiProperty({ description: 'Words skipped (no dictionary details)' })
    skipped: number;

    @ApiProperty({ description: 'Words that failed processing' })
    errored: number;

    @ApiProperty({ description: 'ISO timestamp when the job was created' })
    createdAt: string;

    @ApiProperty({ description: 'ISO timestamp of the last progress update' })
    updatedAt: string;
}

/** Single pronunciation entry (type + URL). */
export class PronunciationItemDto {
    @ApiProperty({ example: 'uk' })
    type: string;

    @ApiProperty({ description: 'Audio URL' })
    url: string;
}

/** IPA (UK/US) for one part of speech. */
export class IpaEntryDto {
    @ApiProperty({ example: 'noun' })
    partOfSpeech: string;

    @ApiPropertyOptional({ nullable: true })
    uk: string | null;

    @ApiPropertyOptional({ nullable: true })
    us: string | null;
}

/** Response for getWordPronunciation. */
export class WordPronunciationResponseDto {
    @ApiProperty({ type: [PronunciationItemDto] })
    pronunciation: PronunciationItemDto[];

    @ApiProperty({ type: [IpaEntryDto] })
    ipas: IpaEntryDto[];
}

/** Single word row returned by getWordsForSyncFilters. */
export class SyncWordItemDto {
    @ApiProperty()
    wordId: string;

    @ApiProperty()
    word: string;

    @ApiPropertyOptional({ nullable: true })
    partOfSpeech: string | null;
}

/** Paginated result from getWordsForSyncFilters. */
export class GetWordsForSyncFiltersResponseDto {
    @ApiProperty({ type: [SyncWordItemDto] })
    words: SyncWordItemDto[];

    @ApiPropertyOptional({
        nullable: true,
        description: 'Cursor for next page',
    })
    nextCursor: string | null;
}

/** Result of processing one word sync (Langeek lookup + DB update). */
export class ProcessWordSyncResultDto {
    @ApiProperty({ enum: ['updated', 'skipped', 'error'] })
    status: 'updated' | 'skipped' | 'error';

    @ApiPropertyOptional({
        description: 'Reason when status is skipped or error',
    })
    reason?: string;
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

    @ApiProperty({
        description: 'URL to thumbnail image, or empty if none',
        example: 'https://cdn.langeek.co/photo/48239/small/?type=jpeg',
    })
    imageThumbnailUrl: string;

    @ApiProperty({
        description: 'Secondary (e.g. British) pronunciation, or empty if none',
        example: 'əkˈjuːmjʊleɪt',
    })
    secondPronunciation: string;
}

/**
 * One translation item from Langeek partOfSpeechRepresentitives (wordEntry.words[0].partOfSpeechRepresentitives[partOfSpeech]).
 * Matches the object shape returned by the Langeek SSG JSON for a single part-of-speech sense.
 */
export class LangeekWordDataDto {
    @ApiProperty()
    id: number;

    @ApiPropertyOptional()
    partOfSpeech?: { partOfSpeechType?: string };

    @ApiPropertyOptional()
    wordPhoto?: { photo?: string; photoThumbnail?: string };

    @ApiProperty({ description: 'English definition/translation' })
    translation: string;

    @ApiPropertyOptional()
    pronunciation?: string;

    @ApiPropertyOptional({
        type: [Object],
        description:
            'Example items with example, exampleVoice and localized translation',
    })
    examples?: {
        id?: number;
        example?: string;
        exampleVoice?: string;
        localizedProperties?: { example?: string };
    }[];

    @ApiPropertyOptional({ description: 'TTS URL for the word' })
    titleVoice?: string;

    @ApiPropertyOptional({ description: 'TTS URL for the translation' })
    translationVoice?: string;

    @ApiPropertyOptional({ example: 'adjective_adverb' })
    type?: string;

    @ApiPropertyOptional()
    title?: string;

    @ApiPropertyOptional()
    localizedProperties?: { translation?: string };
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
        description: 'URL to word image, or empty if none',
        example: 'https://cdn.langeek.co/photo/48239/original/?type=jpeg',
    })
    imageUrl: string;

    @ApiProperty({
        type: [Object],
        description:
            'Example sentences in English with optional per-example TTS and localized (Vietnamese) translation',
        example: [
            {
                text: 'The PlayStation 5 has backward compatibility, so I can still play my PlayStation 4 games on it.',
                audioUrl: 'https://tts.langeek.co/read?text=...',
                translation:
                    'PlayStation 5 có **khả năng tương thích ngược**, nên tôi vẫn có thể chơi các game PlayStation 4 trên đó.',
            },
        ],
    })
    examples: { text: string; audioUrl?: string; translation?: string }[];

    @ApiProperty({
        description: 'URL to thumbnail image, or empty if none',
        example: 'https://cdn.langeek.co/photo/48239/small/?type=jpeg',
    })
    imageThumbnailUrl: string;

    @ApiPropertyOptional({
        description: 'Secondary (e.g. British) pronunciation',
        example: 'əkˈjuːmjʊleɪt',
    })
    secondPronunciation?: string;
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
    localizedData: string[];
}

export const LANGEEK_FILTERS = ['withExamples', 'inCategory', 'photo'] as const;
export type LangeekFilter = (typeof LANGEEK_FILTERS)[number];

/**
 * What the sync actually runs against: the caller's filters plus the owner the
 * controller resolved from the access token. Kept separate from the DTO so the
 * owner cannot arrive over the wire.
 */
export type SyncWordsLangeekFilters = SyncWordsLangeekDto & {
    userId?: string;
};
