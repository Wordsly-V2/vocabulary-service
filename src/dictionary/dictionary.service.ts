import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DictionaryScraper } from '@perqueza72/cambridge-dictionary-scraper';
import { firstValueFrom } from 'rxjs';
import type {
    DictionarySearchResultDto,
    GetWordsForSyncFiltersResponseDto,
    IpaEntryDto,
    LangeekFilter,
    LangeekTranslationItemDto,
    LangeekWordDetailsDto,
    LangeekWordEntryDto,
    ProcessWordSyncResultDto,
    SyncWordsLangeekDto,
    UserWordSearchResultDto,
    WordPronunciationResponseDto,
} from './dto/dictionary.dto';
import { cacheKeys } from '@/cache/cache-keys';
import { CacheService } from '@/cache/cache.service';
import { CacheKind } from '@/cache/cache-ttl';
import { PrismaService } from '@/prisma/prisma.service';
import * as cheerio from 'cheerio';
import { v7 as uuidv7 } from 'uuid';

// Initialize the Cambridge Dictionary scraper
const dictionary = new DictionaryScraper();
const baseCambridgeUrl = 'https://dictionary.cambridge.org';

const LANGEEK_DICTIONARY_BASE = 'https://dictionary.langeek.co';
/** Regex to extract Next.js build ID from script src (e.g. /_next/static/W9DFkAUd2V1IVyQySqa5d/_buildManifest.js or /next/static/.../ssgManifest.js) */
const LANGEEK_BUILD_ID_REGEX = /"buildId":"([^"]+)"/;
/** How long a scraped Langeek build ID stays valid before re-fetching. */
const LANGEEK_BUILD_ID_TTL_MS = 6 * 60 * 60 * 1000;

const encodeKeyPart = (value: string): string =>
    encodeURIComponent(value.trim().toLowerCase()).replace(/%/g, '_');

@Injectable()
export class DictionaryService {
    private langeekBuildId: { value: string; fetchedAt: number } | null = null;

    constructor(
        private readonly httpService: HttpService,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    /**
     * Fetches pronunciation (audio URLs) and IPAs (UK/US) per part of speech.
     * Uses existing DictionaryScraper for pronunciation; fetches Cambridge page for IPA by pos.
     */
    async getWordPronunciation(
        word: string,
    ): Promise<WordPronunciationResponseDto> {
        return this.cacheService.getOrSetGlobal(
            [`dict:pron:${encodeKeyPart(word)}`],
            () => this.fetchWordPronunciation(word),
            CacheKind.Dictionary,
        );
    }

    private async fetchWordPronunciation(
        word: string,
    ): Promise<WordPronunciationResponseDto> {
        const emptyIpas: IpaEntryDto[] = [];
        let pronunciation: WordPronunciationResponseDto['pronunciation'] = [];
        try {
            const pron = await dictionary.pronounciation(word);
            pronunciation = pron.map((item) => ({
                type: item.type,
                url: baseCambridgeUrl + item.url,
            }));
        } catch {
            // keep pronunciation []
        }

        let ipas = emptyIpas;
        const trimmed = word?.trim();
        if (trimmed) {
            try {
                const encoded = encodeURIComponent(trimmed);
                const url = `${baseCambridgeUrl}/dictionary/english/${encoded}`;
                const res = await firstValueFrom(
                    this.httpService.get<string>(url, {
                        headers: {
                            'User-Agent':
                                'Mozilla/5.0 (compatible; Wordsly/1.0)',
                        },
                        responseType: 'text',
                    }),
                );
                ipas = this.extractIpasByPartOfSpeech(cheerio.load(res.data));
            } catch {
                // keep emptyIpas
            }
        }

        return { pronunciation, ipas };
    }

    /**
     * Extracts IPA (UK/US) grouped by part of speech from Cambridge dictionary entry page.
     * Structure: .pr.entry-body__el > .pos-header with .pos.dpos, .uk.dpron-i .ipa, .us.dpron-i .ipa.
     */
    private extractIpasByPartOfSpeech($: cheerio.CheerioAPI): IpaEntryDto[] {
        const results: IpaEntryDto[] = [];
        const seen = new Set<string>();

        // Dictionary entry: each block is .pr.entry-body__el or .pos-header (one part-of-speech per block)
        let $blocks = $('.pr.entry-body__el');
        if ($blocks.length === 0) $blocks = $('.pos-header');
        $blocks.each((_, blockEl) => {
            const $block = $(blockEl);
            const posText =
                $block.find('.pos.dpos').first().text().trim().toLowerCase() ||
                $block.find('.pos').first().text().trim().toLowerCase() ||
                '—';
            const uk: string | null =
                $block.find('.uk.dpron-i .ipa').first().text().trim() ||
                $block.find('.uk .ipa').first().text().trim() ||
                null;
            const us: string | null =
                $block.find('.us.dpron-i .ipa').first().text().trim() ||
                $block.find('.us .ipa').first().text().trim() ||
                null;
            if (!uk && !us) return;
            const key = `${posText}|${uk ?? ''}|${us ?? ''}`;
            if (seen.has(key)) return;
            seen.add(key);
            results.push({ partOfSpeech: posText, uk, us });
        });

        if (results.length > 0) return this.distinctIpas(results);

        // Fallback: flat list of first two .ipa as single entry
        const ipaList: string[] = $('.ipa')
            .map((_, el) => $(el).text().trim())
            .get();
        if (ipaList.length > 0) {
            results.push({
                partOfSpeech: '—',
                uk: ipaList[0]?.trim() || null,
                us: ipaList[1]?.trim() || null,
            });
        }
        return this.distinctIpas(results);
    }

    /** Returns distinct entries by (partOfSpeech, uk, us). */
    private distinctIpas(ipas: IpaEntryDto[]): IpaEntryDto[] {
        return Object.values(
            ipas.reduce(
                (acc, cur) => {
                    const key = cur.partOfSpeech;
                    if (!acc[key]) {
                        acc[key] = { ...cur };
                    } else {
                        acc[key].uk ??= cur.uk;
                        acc[key].us ??= cur.us;
                    }
                    return acc;
                },
                {} as Record<string, IpaEntryDto>,
            ),
        );
    }

    async searchWords(
        word: string,
        filters: LangeekFilter[],
    ): Promise<DictionarySearchResultDto[]> {
        const filterKey = [...filters].sort().join(',') || 'none';
        return this.cacheService.getOrSetGlobal(
            [`dict:search:${encodeKeyPart(word)}:f${filterKey}`],
            () => this.fetchSearchWords(word, filters),
            CacheKind.Dictionary,
        );
    }

    private async fetchSearchWords(
        word: string,
        filters: LangeekFilter[],
    ): Promise<DictionarySearchResultDto[]> {
        try {
            const filterString = filters.join(',');
            const response = await firstValueFrom(
                this.httpService.get<LangeekWordEntryDto[]>(
                    `https://api.langeek.co/v1/cs/en/vi/word/?term=${word}&filter=${filterString}`,
                ),
            );
            const entries = response.data ?? [];
            return this.mapToSearchResults(entries);
        } catch {
            return [];
        }
    }

    /**
     * Fetches the Next.js build ID from dictionary.langeek.co by loading a page
     * and extracting it from script src (e.g. /_next/static/W9DFkAUd2V1IVyQySqa5d/_buildManifest.js or .../ssgManifest.js).
     * Result is cached in memory.
     */
    private async getLangeekBuildId(): Promise<string> {
        const cached = this.langeekBuildId;
        if (cached && Date.now() - cached.fetchedAt < LANGEEK_BUILD_ID_TTL_MS) {
            return cached.value;
        }
        const value = await this.fetchLangeekBuildId();
        this.langeekBuildId = { value, fetchedAt: Date.now() };
        return value;
    }

    private async fetchLangeekBuildId(): Promise<string> {
        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };

        try {
            const res = await firstValueFrom(
                this.httpService.get<string>(LANGEEK_DICTIONARY_BASE, {
                    headers,
                    responseType: 'text',
                    maxRedirects: 5,
                }),
            );
            const match = res.data.match(LANGEEK_BUILD_ID_REGEX);
            if (match?.[1]) {
                return match[1];
            }
        } catch {
            // try next URL
        }
        throw new Error(
            'Could not extract Langeek dictionary build ID from page',
        );
    }

    /**
     * Fetches full word details from dictionary.langeek.co using the SSG data endpoint.
     * When partOfSpeech is provided, selects that sense from wordEntry.words[0].partOfSpeechRepresentitives;
     * otherwise uses the first available sense.
     */
    async getLangeekWordDetails(
        word: string,
        partOfSpeech: string,
    ): Promise<LangeekWordDetailsDto | null> {
        return this.cacheService.getOrSetGlobal(
            [
                `dict:details:v2:${encodeKeyPart(word)}:p${encodeKeyPart(partOfSpeech)}`,
            ],
            () => this.fetchLangeekWordDetails(word, partOfSpeech),
            CacheKind.Dictionary,
        );
    }

    private async fetchLangeekWordDetails(
        word: string,
        partOfSpeech: string,
    ): Promise<LangeekWordDetailsDto | null> {
        try {
            const partOfSpeechNorm = partOfSpeech.trim().toLowerCase();

            const [searchResults, buildId] = await Promise.all([
                this.searchWords(word, []),
                this.getLangeekBuildId(),
            ]);
            if (!searchResults.length) return null;

            const match = searchResults.find(
                (r) =>
                    r.partOfSpeech.trim().toLowerCase() === partOfSpeechNorm &&
                    r.word === word,
            );
            if (!match) return null;

            const url = `${LANGEEK_DICTIONARY_BASE}/_next/data/${buildId}/en-VI/word/${match.langeekWordId}.json`;
            const response = await firstValueFrom(
                this.httpService.get<Record<string, unknown>>(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; Wordsly/1.0)',
                    },
                }),
            );
            const raw = response.data as Record<string, unknown> | null;
            if (!raw) return null;

            const pageProps = raw?.pageProps as
                | Record<string, unknown>
                | undefined;
            const initialState = pageProps?.initialState as
                | Record<string, unknown>
                | undefined;
            const staticData = initialState?.static as
                | Record<string, unknown>
                | undefined;
            const entry = staticData?.wordEntry as
                | Record<string, unknown>
                | undefined;
            const words = entry?.words as Record<string, unknown>[] | undefined;
            const firstWord = words?.[0];
            if (!firstWord || typeof firstWord !== 'object') return null;

            const reps = firstWord.partOfSpeechRepresentitives as
                | Record<string, Record<string, unknown>>
                | undefined;
            if (!reps || typeof reps !== 'object') return null;

            const posKey = partOfSpeech.trim().toLowerCase();
            let wordData: Record<string, unknown> | undefined =
                posKey && reps[posKey] ? reps[posKey] : undefined;
            if (!wordData && posKey) {
                const key = Object.keys(reps).find(
                    (k) => k.toLowerCase() === posKey,
                );
                if (key) wordData = reps[key];
            }
            if (!wordData && Object.keys(reps).length > 0) {
                const firstKey = Object.keys(reps)[0];
                wordData = reps[firstKey];
            }
            if (!wordData || typeof wordData !== 'object') return null;

            const rawExamples = wordData.examples as
                | { example?: string; exampleVoice?: string }[]
                | undefined;
            const examples = Array.isArray(rawExamples)
                ? rawExamples
                      .filter((e) => e?.example?.trim())
                      .map((e) => ({
                          text: e.example as string,
                          audioUrl: e.exampleVoice || undefined,
                      }))
                : [];

            const metadata = wordData.metadata as
                | { extraProperties?: { pos_ipa?: { american?: string } } }
                | undefined;
            const pronunciation = metadata?.extraProperties?.pos_ipa
                ?.american as string;

            return {
                word,
                meaning: match.meaning,
                partOfSpeech: match.partOfSpeech,
                pronunciation,
                audioUrl: firstWord.wordVoice as string,
                imageUrl: match.imageUrl,
                imageThumbnailUrl: match.imageThumbnailUrl,
                examples,
                wordForms: match.otherForms ?? [],
                secondPronunciation: match.secondPronunciation || undefined,
            };
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response
                ?.status;
            if (status === 404) {
                return null;
            }
            throw new InternalServerErrorException(
                'Failed to fetch word details',
            );
        }
    }

    /**
     * Maps a single Langeek word-data object (from partOfSpeechRepresentitives[partOfSpeech])
     * to our public word-details shape. Uses the structure from the Langeek SSG JSON.
     */
    private mapLangeekRawToWordDetails(
        wordData: Record<string, unknown>,
    ): LangeekWordDetailsDto | null {
        const partOfSpeechObj = wordData.partOfSpeech as
            | { partOfSpeechType?: string }
            | undefined;
        const partOfSpeech =
            partOfSpeechObj?.partOfSpeechType ??
            (wordData.type as string) ??
            '';

        const localizedProperties = wordData.localizedProperties as
            | { translation?: string; otherTranslations?: string }
            | undefined;

        const meaning = this.mergeMeanings([
            localizedProperties?.translation,
            localizedProperties?.otherTranslations,
        ]);

        const posIpa = wordData.metadata as
            | {
                  nlpAnalyzedData?: {
                      pronunciationIPA?: string;
                  };
              }
            | undefined;

        const pronunciation = posIpa?.nlpAnalyzedData?.pronunciationIPA ?? '';
        const wordPhoto = wordData.wordPhoto as { photo?: string } | undefined;
        const imageUrl = wordPhoto?.photo ?? '';
        const audioUrl = (wordData.titleVoice as string) ?? '';

        const word = wordData.title as string;

        const examples: { text: string; audioUrl?: string }[] = [];
        const seenExamples = new Set<string>();
        const exArr = wordData.examples as
            | { example?: string; exampleVoice?: string }[]
            | undefined;
        if (Array.isArray(exArr)) {
            for (const ex of exArr) {
                const text = ex?.example?.trim();
                if (text && !seenExamples.has(text)) {
                    seenExamples.add(text);
                    examples.push({
                        text,
                        audioUrl: ex.exampleVoice || undefined,
                    });
                }
            }
        }

        const wordPhotoThumb = wordData.wordPhoto as
            | { photoThumbnail?: string }
            | undefined;

        return {
            word,
            meaning,
            partOfSpeech,
            pronunciation,
            audioUrl,
            imageUrl,
            imageThumbnailUrl: wordPhotoThumb?.photoThumbnail ?? '',
            examples,
            wordForms: [],
        };
    }

    async getWordExamples(word: string): Promise<string[]> {
        return this.cacheService.getOrSetGlobal(
            [`dict:examples:${encodeKeyPart(word)}`],
            () => this.fetchWordExamples(word),
            CacheKind.Dictionary,
        );
    }

    private async fetchWordExamples(word: string): Promise<string[]> {
        try {
            const meanings = await dictionary.meaning(word);
            const examples = meanings.reduce<string[]>((acc, curr) => {
                if (curr.ex.length) {
                    acc.push(curr.ex[0]);
                }
                return acc;
            }, []);

            return [...new Set(examples)];
        } catch {
            return [];
        }
    }

    /** Maximum number of distinct meanings kept per part of speech. */
    private static readonly MAX_MEANINGS = 4;

    /**
     * De-duplicates a list of comma-separated translation strings into a single
     * comma-separated string of at most {@link MAX_MEANINGS} distinct terms.
     * Splits on commas, trims, and drops duplicates (case-insensitive) while
     * preserving order.
     */
    private mergeMeanings(translations: (string | undefined | null)[]): string {
        const seen = new Set<string>();
        const terms: string[] = [];
        for (const translation of translations) {
            if (!translation) continue;
            for (const part of translation.split(',')) {
                const term = part.trim();
                if (!term) continue;
                const key = term.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                terms.push(term);
                if (terms.length >= DictionaryService.MAX_MEANINGS) {
                    return terms.join(', ');
                }
            }
        }
        return terms.join(', ');
    }

    /**
     * Merges the localized (Vietnamese) translations of every sense within one
     * part-of-speech group into a single, de-duplicated, comma-separated string
     * of at most {@link MAX_MEANINGS} meanings. Each item is a distinct sense
     * and its translation may itself be a comma-separated list.
     */
    private mergeTranslations(items: LangeekTranslationItemDto[]): string {
        return this.mergeMeanings(
            items.map((item) => item.localizedProperties?.translation),
        );
    }

    private mapToSearchResults(
        entries: LangeekWordEntryDto[],
    ): DictionarySearchResultDto[] {
        const results: DictionarySearchResultDto[] = [];

        for (const entry of entries) {
            const translations = entry.translations ?? {};
            for (const [partOfSpeech, items] of Object.entries(translations)) {
                if (
                    partOfSpeech === 'sentence' ||
                    !Array.isArray(items) ||
                    items.length === 0
                )
                    continue;

                const meaning = this.mergeTranslations(items);

                const imageUrl =
                    items.find((it) => it.wordPhoto?.photo)?.wordPhoto?.photo ??
                    '';

                const imageThumbnailUrl =
                    items.find((it) => it.wordPhoto?.photoThumbnail)?.wordPhoto
                        ?.photoThumbnail ?? '';

                results.push({
                    langeekWordId: entry.id,
                    word: entry.entry,
                    partOfSpeech,
                    meaning,
                    imageUrl,
                    imageThumbnailUrl,
                    otherForms: entry.otherForms ?? [],
                    secondPronunciation: entry.secondPronunciation ?? '',
                });
            }
        }

        return results;
    }

    /**
     * Search words created by the user across all their courses.
     * Matches search term against word and meaning (case-insensitive).
     */
    async searchUserWords(
        userLoginId: string,
        searchTerm: string,
        limit = 10,
    ): Promise<UserWordSearchResultDto[]> {
        if (!searchTerm?.trim()) {
            return [];
        }
        const term = searchTerm.trim();
        const take = Math.min(limit, 100);

        return this.cacheService.getOrSet(
            userLoginId,
            [cacheKeys.searchUserWords(userLoginId, term, take)],
            async () => {
                const words = await this.prisma.word.findMany({
                    where: {
                        lesson: {
                            course: { userLoginId },
                        },
                        OR: [
                            { word: { contains: term, mode: 'insensitive' } },
                            {
                                meaning: {
                                    contains: term,
                                    mode: 'insensitive',
                                },
                            },
                        ],
                    },
                    take,
                    orderBy: { word: 'asc' },
                    select: {
                        id: true,
                        word: true,
                        meaning: true,
                        partOfSpeech: true,
                        imageUrl: true,
                        lessonId: true,
                        lesson: {
                            select: {
                                name: true,
                                courseId: true,
                                course: { select: { name: true } },
                            },
                        },
                    },
                });
                return words.map((w) => ({
                    id: w.id,
                    word: w.word,
                    meaning: w.meaning,
                    partOfSpeech: w.partOfSpeech,
                    imageUrl: w.imageUrl,
                    lessonId: w.lessonId,
                    lessonName: w.lesson.name,
                    courseId: w.lesson.courseId,
                    courseName: w.lesson.course.name,
                }));
            },
            CacheKind.Search,
        );
    }

    /** Default page size for getWordsForSyncFilters to avoid loading too many rows. */
    private static readonly SYNC_WORDS_PAGE_SIZE = 500;

    /**
     * Returns a page of words matching the given filters (cursor-based pagination).
     * Used by the API gateway to produce one Kafka message per word without loading all rows.
     */
    async getWordsForSyncFilters(
        filters?: SyncWordsLangeekDto,
    ): Promise<GetWordsForSyncFiltersResponseDto> {
        type WordWhere = {
            id?: string;
            lessonId?: string;
            lesson?: { courseId?: string; course?: { userLoginId?: string } };
        };
        const where: WordWhere = {};

        if (filters?.wordId) {
            where.id = filters.wordId;
        }
        if (filters?.lessonId) {
            where.lessonId = filters.lessonId;
        }
        if (filters?.courseId || filters?.userId) {
            where.lesson = {};
            if (filters.courseId) {
                where.lesson.courseId = filters.courseId;
            }
            if (filters.userId) {
                where.lesson.course = { userLoginId: filters.userId };
            }
        }

        const pageSize = Math.min(
            filters?.limit ?? DictionaryService.SYNC_WORDS_PAGE_SIZE,
            2000,
        );
        const take = pageSize + 1;

        const rows = await this.prisma.word.findMany({
            where: Object.keys(where).length > 0 ? where : undefined,
            select: { id: true, word: true, partOfSpeech: true },
            orderBy: { id: 'asc' },
            cursor: filters?.cursor ? { id: filters.cursor } : undefined,
            take,
            skip: filters?.cursor ? 1 : 0,
        });

        const hasMore = rows.length > pageSize;
        const words = (hasMore ? rows.slice(0, pageSize) : rows).map((w) => ({
            wordId: w.id,
            word: w.word,
            partOfSpeech: w.partOfSpeech,
        }));
        const nextCursor =
            hasMore && words.length > 0 ? words[words.length - 1].wordId : null;

        return { words, nextCursor };
    }

    /**
     * Processes a single word sync (Langeek lookup + DB update). Called by the Kafka consumer.
     */
    async processOneWordSync(
        wordId: string,
        word: string,
        partOfSpeech: string,
    ): Promise<ProcessWordSyncResultDto> {
        try {
            const wordDetails = await this.getLangeekWordDetails(
                word,
                partOfSpeech,
            );
            if (!wordDetails) {
                return { status: 'skipped', reason: 'no_word_details' };
            }

            // Cambridge UK/US audio + IPA. Best-effort: a Cambridge failure must
            // NOT fail the sync (and hence must not fail the Kafka message).
            let ukAudioUrl: string | undefined;
            let usAudioUrl: string | undefined;
            let ukIpa: string | undefined;
            let usIpa: string | undefined;
            try {
                const pron = await this.getWordPronunciation(word);
                ukAudioUrl =
                    pron.pronunciation.find(
                        (p) => p.type?.toLowerCase() === 'uk',
                    )?.url || undefined;
                usAudioUrl =
                    pron.pronunciation.find(
                        (p) => p.type?.toLowerCase() === 'us',
                    )?.url || undefined;
                const posNorm = (wordDetails.partOfSpeech || partOfSpeech)
                    ?.trim()
                    .toLowerCase();
                const ipaEntry =
                    (posNorm &&
                        pron.ipas.find(
                            (i) => i.partOfSpeech.toLowerCase() === posNorm,
                        )) ||
                    pron.ipas[0];
                ukIpa = ipaEntry?.uk || undefined;
                usIpa = ipaEntry?.us || undefined;
            } catch {
                // keep UK/US fields undefined on Cambridge failure
            }

            const example = wordDetails.examples?.length
                ? JSON.stringify(wordDetails.examples.map((e) => e.text))
                : null;

            const wordForms = wordDetails.wordForms?.length
                ? wordDetails.wordForms
                : undefined;

            await this.prisma.$transaction([
                this.prisma.word.update({
                    where: { id: wordId },
                    data: {
                        meaning: wordDetails.meaning || undefined,
                        pronunciation: wordDetails.pronunciation || undefined,
                        partOfSpeech: wordDetails.partOfSpeech || undefined,
                        audioUrl: wordDetails.audioUrl || undefined,
                        imageUrl: wordDetails.imageUrl || undefined,
                        imageThumbnailUrl:
                            wordDetails.imageThumbnailUrl || undefined,
                        ukAudioUrl,
                        usAudioUrl,
                        ukIpa,
                        usIpa,
                        wordForms,
                        example,
                    },
                }),
                this.prisma.wordExample.deleteMany({ where: { wordId } }),
                this.prisma.wordExample.createMany({
                    data: wordDetails.examples.map((e, index) => ({
                        id: uuidv7(),
                        wordId,
                        text: e.text,
                        audioUrl: e.audioUrl || null,
                        orderIndex: index,
                    })),
                }),
            ]);

            const owner = await this.prisma.word.findUnique({
                where: { id: wordId },
                select: {
                    lesson: {
                        select: {
                            course: { select: { userLoginId: true } },
                        },
                    },
                },
            });
            const userLoginId = owner?.lesson?.course?.userLoginId;
            if (userLoginId) {
                await this.cacheService.invalidateUser(userLoginId);
            }

            return { status: 'updated' };
        } catch (err: unknown) {
            const reason = err instanceof Error ? err.message : String(err);
            return { status: 'error', reason };
        }
    }
}
