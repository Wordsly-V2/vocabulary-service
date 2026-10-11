import { HttpService } from '@nestjs/axios';
import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
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
    SyncJobStatus,
    SyncJobStatusDto,
    SyncWordsLangeekFilters,
    UserWordSearchResultDto,
    WordPronunciationResponseDto,
} from './dto/dictionary.dto';
import { cacheKeys, OFFICIAL_CACHE_PREFIX } from '@/cache/cache-keys';
import { CacheService } from '@/cache/cache.service';
import { CacheKind } from '@/cache/cache-ttl';
import { PrismaService } from '@/prisma/prisma.service';
import { DICTIONARY_SYNC_WORD_LANGEEK_TOPIC } from '@/messaging/constants';
import { KafkaProducerService } from '@/messaging/kafka-producer.service';
import * as cheerio from 'cheerio';
import {
    normalizeCefrLevel,
    planWordUpdate,
    SYNC_FIELDS,
    type FetchedWord,
    type SyncField,
    type SyncMode,
} from './word-sync.logic';
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
    private readonly logger = new Logger(DictionaryService.name);
    private langeekBuildId: { value: string; fetchedAt: number } | null = null;

    constructor(
        private readonly httpService: HttpService,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly kafkaProducer: KafkaProducerService,
    ) {}

    /**
     * Enqueue a Langeek sync for every word matching the filters.
     *
     * This orchestration used to live in the API gateway, which meant creating
     * the job and paging through the words were two HTTP round trips per page
     * against this very service. Here they are ordinary method calls: the
     * paginated network loop becomes a local query, and the topic name is the
     * same constant the consumer subscribes to, so producer and consumer cannot
     * drift apart.
     *
     * No-ops silently when Kafka is unconfigured, like every other producer in
     * the workspace — the job is still created, with nothing enqueued.
     */
    async syncWordsWithLangeek(
        filters?: SyncWordsLangeekFilters,
    ): Promise<{ jobId: string; total: number; enqueued: number }> {
        // Created first, so its total is authoritative and the job exists before
        // any consumer starts reporting progress against it.
        const job = await this.createSyncJob(filters);

        let enqueued = 0;
        let cursor: string | undefined;

        do {
            const page = await this.getWordsForSyncFilters({
                ...(filters ?? {}),
                cursor,
                limit: DictionaryService.SYNC_WORDS_PAGE_SIZE,
            });

            const words = page?.words ?? [];
            if (words.length > 0) {
                await this.kafkaProducer.sendBatch(
                    DICTIONARY_SYNC_WORD_LANGEEK_TOPIC,
                    words.map((entry) => ({
                        wordId: entry.wordId,
                        word: entry.word,
                        partOfSpeech: entry.partOfSpeech,
                        jobId: job.jobId,
                    })),
                );
                enqueued += words.length;
            }

            cursor = page?.nextCursor ?? undefined;
        } while (cursor);

        return { jobId: job.jobId, total: job.total, enqueued };
    }

    /**
     * Fetches pronunciation (audio URLs) and IPAs (UK/US) per part of speech.
     * Uses existing DictionaryScraper for pronunciation; fetches Cambridge page for IPA by pos.
     */
    async getWordPronunciation(
        word: string,
        options: { refresh?: boolean } = {},
    ): Promise<WordPronunciationResponseDto> {
        // Two independent Cambridge calls, either of which may fail on its own.
        // Whatever came back is still returned, but a run where a leg failed is
        // not written: caching it would freeze a half (or wholly) empty entry
        // for the Dictionary TTL because of a moment's network trouble.
        let degraded = false;
        return this.cacheService.getOrSetGlobal(
            [`dict:pron:${encodeKeyPart(word)}`],
            async () => {
                const result = await this.fetchWordPronunciation(word);
                degraded = result.degraded;
                return {
                    pronunciation: result.pronunciation,
                    ipas: result.ipas,
                };
            },
            CacheKind.Dictionary,
            { shouldCache: () => !degraded, refresh: options.refresh },
        );
    }

    /** `degraded` is true when a leg failed, so the caller can skip caching. */
    private async fetchWordPronunciation(
        word: string,
    ): Promise<WordPronunciationResponseDto & { degraded: boolean }> {
        const emptyIpas: IpaEntryDto[] = [];
        let degraded = false;
        let pronunciation: WordPronunciationResponseDto['pronunciation'] = [];
        try {
            const pron = await dictionary.pronounciation(word);
            pronunciation = pron.map((item) => ({
                type: item.type,
                url: baseCambridgeUrl + item.url,
            }));
        } catch (err: unknown) {
            degraded = true;
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
                `Cambridge audio lookup failed for "${word}": ${message}`,
            );
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
            } catch (err: unknown) {
                degraded = true;
                const message =
                    err instanceof Error ? err.message : String(err);
                this.logger.warn(
                    `Cambridge IPA lookup failed for "${word}": ${message}`,
                );
            }
        }

        return { pronunciation, ipas, degraded };
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

    /**
     * Search, degrading to no results when Langeek is unreachable.
     *
     * The swallow lives here rather than around the fetch so that a failure
     * never reaches the cache: `searchWordsCached` lets the error out, and a
     * factory that throws leaves the key unwritten. Swallowing inside the
     * factory instead wrote `[]` under the Dictionary TTL, so one timeout hid a
     * perfectly real word for seven days. An empty answer Langeek actually gave
     * is still cached — that one is a fact about the word, not about the network.
     */
    async searchWords(
        word: string,
        filters: LangeekFilter[],
    ): Promise<DictionarySearchResultDto[]> {
        try {
            return await this.searchWordsCached(word, filters);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
                `Langeek search failed for "${word}" (not cached): ${message}`,
            );
            return [];
        }
    }

    /** Cached search that propagates an upstream failure to its caller. */
    private async searchWordsCached(
        word: string,
        filters: LangeekFilter[],
        refresh = false,
    ): Promise<DictionarySearchResultDto[]> {
        const filterKey = [...filters].sort().join(',') || 'none';
        return this.cacheService.getOrSetGlobal(
            [`dict:search:${encodeKeyPart(word)}:f${filterKey}`],
            () => this.fetchSearchWords(word, filters),
            CacheKind.Dictionary,
            { refresh },
        );
    }

    private async fetchSearchWords(
        word: string,
        filters: LangeekFilter[],
    ): Promise<DictionarySearchResultDto[]> {
        const filterString = filters.join(',');
        const response = await firstValueFrom(
            this.httpService.get<LangeekWordEntryDto[]>(
                `https://api.langeek.co/v1/cs/en/vi/word/?term=${encodeURIComponent(word)}&filter=${filterString}`,
            ),
        );
        const entries = response.data ?? [];
        return this.mapToSearchResults(entries);
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
        options: { refresh?: boolean } = {},
    ): Promise<LangeekWordDetailsDto | null> {
        const refresh = options.refresh ?? false;
        return this.cacheService.getOrSetGlobal(
            [
                `dict:details:v2:${encodeKeyPart(word)}:p${encodeKeyPart(partOfSpeech)}`,
            ],
            () => this.fetchLangeekWordDetails(word, partOfSpeech, refresh),
            CacheKind.Dictionary,
            { refresh },
        );
    }

    private async fetchLangeekWordDetails(
        word: string,
        partOfSpeech: string,
        refresh = false,
    ): Promise<LangeekWordDetailsDto | null> {
        try {
            const partOfSpeechNorm = partOfSpeech.trim().toLowerCase();

            // The cached variant, deliberately: a swallowed upstream failure
            // would arrive as an empty list and be stored below as "this word
            // has no details" for the Dictionary TTL. Letting it throw lands in
            // the catch, which caches nothing.
            const [searchResults, buildId] = await Promise.all([
                this.searchWordsCached(word, [], refresh),
                this.getLangeekBuildId(),
            ]);
            if (!searchResults.length) return null;

            // A word saved without a part of speech takes Langeek's first
            // sense, so a sync can fill it in.
            const match = searchResults.find(
                (r) =>
                    r.word === word &&
                    (!partOfSpeechNorm ||
                        r.partOfSpeech.trim().toLowerCase() ===
                            partOfSpeechNorm),
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
                | {
                      example?: string;
                      exampleVoice?: string;
                      localizedProperties?: { example?: string };
                  }[]
                | undefined;
            const examples = Array.isArray(rawExamples)
                ? rawExamples
                      .filter((e) => e?.example?.trim())
                      .map((e) => ({
                          text: e.example as string,
                          audioUrl: e.exampleVoice || undefined,
                          translation:
                              e.localizedProperties?.example?.trim() ||
                              undefined,
                      }))
                : [];

            const metadata = wordData.metadata as
                | { extraProperties?: { pos_ipa?: { american?: string } } }
                | undefined;
            const pronunciation = metadata?.extraProperties?.pos_ipa
                ?.american as string;

            return {
                word,
                cefrLevel: normalizeCefrLevel(wordData.level),
                meaning: match.meaning,
                partOfSpeech: match.partOfSpeech,
                pronunciation,
                audioUrl: firstWord.wordVoice as string,
                imageUrl: match.imageUrl,
                imageThumbnailUrl: match.imageThumbnailUrl,
                examples,
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

        const examples: {
            text: string;
            audioUrl?: string;
            translation?: string;
        }[] = [];
        const seenExamples = new Set<string>();
        const exArr = wordData.examples as
            | {
                  example?: string;
                  exampleVoice?: string;
                  localizedProperties?: { example?: string };
              }[]
            | undefined;
        if (Array.isArray(exArr)) {
            for (const ex of exArr) {
                const text = ex?.example?.trim();
                if (text && !seenExamples.has(text)) {
                    seenExamples.add(text);
                    examples.push({
                        text,
                        audioUrl: ex.exampleVoice || undefined,
                        translation:
                            ex.localizedProperties?.example?.trim() ||
                            undefined,
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

    /** How long a sync-job progress record lives in Redis. */
    private static readonly SYNC_JOB_TTL_SECONDS = 24 * 60 * 60;

    /** Redis key for a sync job's progress hash (global; survives per-user invalidation). */
    private static syncJobKey(jobId: string): string {
        return `vocab:g:sync-job:${jobId}`;
    }

    /** Builds the Prisma `where` for word filters shared by count + pagination. */
    private buildWordWhere(filters?: SyncWordsLangeekFilters): {
        id?: string;
        lessonId?: string;
        lesson?: { courseId?: string; course?: { userLoginId?: string } };
    } {
        const where: {
            id?: string;
            lessonId?: string;
            lesson?: { courseId?: string; course?: { userLoginId?: string } };
        } = {};

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

        return where;
    }

    /**
     * Creates a sync-job progress record in Redis, counting the total words that
     * match the filters. Returns the job id used to poll progress. When there are
     * no words the job is marked completed immediately.
     */
    async createSyncJob(
        filters?: SyncWordsLangeekFilters,
    ): Promise<{ jobId: string; total: number; status: SyncJobStatus }> {
        const jobId = uuidv7();
        const where = this.buildWordWhere(filters);
        const total = await this.prisma.word.count({
            where: Object.keys(where).length > 0 ? where : undefined,
        });
        const status: SyncJobStatus = total > 0 ? 'in_progress' : 'completed';
        const now = new Date().toISOString();

        await this.cacheService.hInit(
            DictionaryService.syncJobKey(jobId),
            {
                jobId,
                userId: filters?.userId ?? '',
                total,
                done: 0,
                updated: 0,
                skipped: 0,
                errored: 0,
                status,
                createdAt: now,
                updatedAt: now,
            },
            DictionaryService.SYNC_JOB_TTL_SECONDS,
        );

        return { jobId, total, status };
    }

    /**
     * Records the outcome of processing one word against its sync job. Atomically
     * bumps the processed counter and flips the job to `completed` once every word
     * has been handled. No-op when jobId is absent or Redis is disabled.
     */
    async recordSyncProgress(
        jobId: string | undefined,
        status: 'updated' | 'skipped' | 'error',
    ): Promise<void> {
        if (!jobId) {
            return;
        }
        const key = DictionaryService.syncJobKey(jobId);
        const field = status === 'error' ? 'errored' : status;

        const done = await this.cacheService.hIncr(key, 'done', 1);
        await this.cacheService.hIncr(key, field, 1);
        if (done === null) {
            return; // Redis disabled — nothing to update.
        }

        const data = await this.cacheService.hGetAll(key);
        const total = Number(data?.total ?? 0);
        const now = new Date().toISOString();
        if (total > 0 && done >= total) {
            await this.cacheService.hSet(key, {
                status: 'completed',
                updatedAt: now,
            });
        } else {
            await this.cacheService.hSet(key, { updatedAt: now });
        }
    }

    /**
     * Returns a sync job's progress, or null when it doesn't exist (or has
     * expired). When `requesterUserId` is provided, only the job's owner can read
     * it (returns null otherwise).
     */
    async getSyncJob(
        jobId: string,
        requesterUserId?: string,
    ): Promise<SyncJobStatusDto | null> {
        const data = await this.cacheService.hGetAll(
            DictionaryService.syncJobKey(jobId),
        );
        if (!data) {
            return null;
        }
        if (requesterUserId && data.userId && data.userId !== requesterUserId) {
            return null;
        }

        const total = Number(data.total ?? 0);
        const done = Number(data.done ?? 0);
        return {
            jobId,
            status: (data.status as SyncJobStatus) ?? 'in_progress',
            total,
            done,
            remaining: Math.max(0, total - done),
            updated: Number(data.updated ?? 0),
            skipped: Number(data.skipped ?? 0),
            errored: Number(data.errored ?? 0),
            createdAt: data.createdAt ?? '',
            updatedAt: data.updatedAt ?? '',
        };
    }

    /**
     * Returns a page of words matching the given filters (cursor-based pagination).
     * Used by the API gateway to produce one Kafka message per word without loading all rows.
     */
    async getWordsForSyncFilters(
        filters?: SyncWordsLangeekFilters,
    ): Promise<GetWordsForSyncFiltersResponseDto> {
        const where = this.buildWordWhere(filters);

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
     * Processes a single word sync (Langeek lookup + DB update). Called by the
     * Kafka consumer. Without options it is the learner sync: every field, and
     * examples merged into the stored ones. Admin runs pick the field groups
     * and the mode, and `refresh` skips the dictionary cache so a re-sync sees
     * what Langeek has now.
     */
    async processOneWordSync(
        wordId: string,
        word: string,
        partOfSpeech: string | null,
        options: {
            fields?: readonly SyncField[];
            mode?: SyncMode;
            refresh?: boolean;
        } = {},
    ): Promise<ProcessWordSyncResultDto> {
        const fields = options.fields ?? SYNC_FIELDS;
        const mode = options.mode ?? 'merge';
        const refresh = options.refresh ?? false;
        try {
            // Also carries the owner, for the cache to drop afterwards.
            const current = await this.prisma.word.findUnique({
                where: { id: wordId },
                select: {
                    meaning: true,
                    pronunciation: true,
                    partOfSpeech: true,
                    audioUrl: true,
                    imageUrl: true,
                    imageThumbnailUrl: true,
                    ukAudioUrl: true,
                    usAudioUrl: true,
                    ukIpa: true,
                    usIpa: true,
                    cefrLevel: true,
                    example: true,
                    lesson: {
                        select: {
                            course: { select: { userLoginId: true } },
                        },
                    },
                },
            });
            if (!current) {
                return { status: 'skipped', reason: 'word_deleted' };
            }

            const wordDetails = await this.getLangeekWordDetails(
                word,
                partOfSpeech ?? '',
                { refresh },
            );
            if (!wordDetails) {
                return { status: 'skipped', reason: 'no_word_details' };
            }

            const fetched: FetchedWord = {
                meaning: wordDetails.meaning,
                pronunciation: wordDetails.pronunciation,
                partOfSpeech: wordDetails.partOfSpeech,
                audioUrl: wordDetails.audioUrl,
                imageUrl: wordDetails.imageUrl,
                imageThumbnailUrl: wordDetails.imageThumbnailUrl,
                cefrLevel: wordDetails.cefrLevel,
                examples: wordDetails.examples ?? [],
            };

            // Cambridge UK/US audio + IPA, only when pronunciation is asked
            // for. Best-effort: a Cambridge failure must NOT fail the sync (and
            // hence must not fail the Kafka message).
            if (fields.includes('pronunciation')) {
                try {
                    const pron = await this.getWordPronunciation(word, {
                        refresh,
                    });
                    fetched.ukAudioUrl = pron.pronunciation.find(
                        (p) => p.type?.toLowerCase() === 'uk',
                    )?.url;
                    fetched.usAudioUrl = pron.pronunciation.find(
                        (p) => p.type?.toLowerCase() === 'us',
                    )?.url;
                    const posNorm = (wordDetails.partOfSpeech || partOfSpeech)
                        ?.trim()
                        .toLowerCase();
                    const ipaEntry =
                        (posNorm &&
                            pron.ipas.find(
                                (i) => i.partOfSpeech.toLowerCase() === posNorm,
                            )) ||
                        pron.ipas[0];
                    fetched.ukIpa = ipaEntry?.uk;
                    fetched.usIpa = ipaEntry?.us;
                } catch {
                    // keep UK/US fields unset on Cambridge failure
                }
            }

            // Never writes a blank (planWordUpdate drops them): writing null
            // here used to wipe seeded examples whenever Langeek had no
            // matching sense.
            const plan = planWordUpdate(current, fetched, fields, mode);

            await this.prisma.word.update({
                where: { id: wordId },
                data: { ...plan.data, langeekSyncedAt: new Date() },
            });

            if (plan.changedFields.length > 0) {
                const userLoginId = current.lesson?.course?.userLoginId;
                if (userLoginId) {
                    await this.cacheService.invalidateUser(userLoginId);
                } else {
                    // An official word: the learner catalogue is cached globally.
                    await this.cacheService.invalidateGlobal(
                        OFFICIAL_CACHE_PREFIX,
                    );
                }
                return { status: 'updated', changedFields: plan.changedFields };
            }

            return {
                status: 'skipped',
                reason: 'no_changes',
                changedFields: [],
            };
        } catch (err: unknown) {
            const reason = err instanceof Error ? err.message : String(err);
            return { status: 'error', reason };
        }
    }
}
