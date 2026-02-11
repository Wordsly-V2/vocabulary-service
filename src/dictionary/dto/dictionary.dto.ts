import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Simplified dictionary search result (public API response). */
export class DictionarySearchResultDto {
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
