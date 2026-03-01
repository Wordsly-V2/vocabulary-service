import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DictionaryScraper } from '@perqueza72/cambridge-dictionary-scraper';
import { firstValueFrom } from 'rxjs';
import type {
    DictionarySearchResultDto,
    LangeekWordEntryDto,
} from './dto/dictionary.dto';
import { PrismaService } from '@/prisma/prisma.service';
import * as cheerio from 'cheerio';

/** Structured word details extracted from Langeek SSG JSON (matches LangeekWordDetailsDto). */
export interface LangeekWordDetailsResult {
    word: string;
    meaning: string;
    partOfSpeech: string;
    pronunciation: string;
    audioUrl: string;
    examples: string[];
}

// Initialize the Cambridge Dictionary scraper
const dictionary = new DictionaryScraper();
const baseCambridgeUrl = 'https://dictionary.cambridge.org';

const LANGEEK_DICTIONARY_BASE = 'https://dictionary.langeek.co';
/** Regex to extract Next.js build ID from script src (e.g. /_next/static/W9DFkAUd2V1IVyQySqa5d/_buildManifest.js or /next/static/.../ssgManifest.js) */
const LANGEEK_BUILD_ID_REGEX = /"buildId":"([^"]+)"/;

@Injectable()
export class DictionaryService {
    constructor(
        private readonly httpService: HttpService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * Fetches pronunciation (audio URLs) and IPAs (UK/US) per part of speech.
     * Uses existing DictionaryScraper for pronunciation; fetches Cambridge page for IPA by pos.
     */
    async getWordPronunciation(word: string): Promise<{
        pronunciation: { type: string; url: string }[];
        ipas: { partOfSpeech: string; uk: string | null; us: string | null }[];
    }> {
        const emptyIpas: {
            partOfSpeech: string;
            uk: string | null;
            us: string | null;
        }[] = [];
        let pronunciation: { type: string; url: string }[] = [];
        try {
            const pron = await dictionary.pronounciation(word);
            pronunciation = pron.map((item) => {
                item.url = baseCambridgeUrl + item.url;
                return item;
            });
        } catch {
            // keep pronunciation []
        }

        let ipas = emptyIpas;
        const trimmed = word?.trim();
        if (trimmed) {
            try {
                const encoded = encodeURIComponent(trimmed);
                // Dictionary entry page has .pos-header per part of speech with .uk/.us .ipa
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
    private extractIpasByPartOfSpeech(
        $: cheerio.CheerioAPI,
    ): { partOfSpeech: string; uk: string | null; us: string | null }[] {
        const results: {
            partOfSpeech: string;
            uk: string | null;
            us: string | null;
        }[] = [];
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
    private distinctIpas(
        ipas: { partOfSpeech: string; uk: string | null; us: string | null }[],
    ) {
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
                {} as Record<
                    string,
                    {
                        partOfSpeech: string;
                        uk: string | null;
                        us: string | null;
                    }
                >,
            ),
        );
    }

    async searchWords(word: string): Promise<DictionarySearchResultDto[]> {
        try {
            const response = await firstValueFrom(
                this.httpService.get<LangeekWordEntryDto[]>(
                    `https://api.langeek.co/v1/cs/en/vi/word/?term=${word}&filter=,inCategory,photo,withExamples`,
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
     * Extracts and returns structured data from pageProps.initialState.static.wordEntry.
     */
    async getLangeekWordDetails(
        langeekWordId: number,
    ): Promise<LangeekWordDetailsResult | null> {
        try {
            const buildId = await this.getLangeekBuildId();
            const url = `${LANGEEK_DICTIONARY_BASE}/_next/data/${buildId}/en-VI/word/${langeekWordId}.json`;
            const response = await firstValueFrom(
                this.httpService.get<Record<string, unknown>>(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; Wordsly/1.0)',
                    },
                }),
            );
            const raw = response.data ?? null;
            return raw ? this.mapLangeekRawToWordDetails(raw) : null;
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
     * Extracts word details from Langeek SSG JSON. Path: pageProps.initialState.static.wordEntry
     */
    private mapLangeekRawToWordDetails(
        data: Record<string, unknown>,
    ): LangeekWordDetailsResult | null {
        const pageProps = data?.pageProps as
            | Record<string, unknown>
            | undefined;
        const initialState = pageProps?.initialState as
            | Record<string, unknown>
            | undefined;
        const staticData = initialState?.static as
            | Record<string, unknown>
            | undefined;
        const wordEntry = staticData?.wordEntry as
            | Record<string, unknown>
            | undefined;
        if (!wordEntry) return null;
        const words = wordEntry.words as Record<string, unknown>[] | undefined;
        const firstWord = words?.[0];
        if (!firstWord || typeof firstWord !== 'object') return null;

        const word = (firstWord.word as string) ?? '';
        const pronunciation = (firstWord.pronunciation as string) ?? '';
        const audioUrl = (firstWord.wordVoice as string) ?? '';

        const translations = firstWord.translations as
            | Record<string, unknown>[]
            | undefined;
        const firstTranslation = translations?.[0];
        const localizedProps = firstTranslation?.localizedProperties as
            | Record<string, unknown>
            | undefined;
        const meaning = (localizedProps?.translation as string) ?? '';
        const partOfSpeech =
            (firstTranslation?.type as string) ??
            ((firstTranslation?.partOfSpeech as Record<string, unknown>)
                ?.partOfSpeechType as string) ??
            '';

        const examples: string[] = [];
        const simpleExamples = wordEntry.simpleExamples as
            | Record<string, { words?: string[] }[]>
            | undefined;
        if (simpleExamples && typeof simpleExamples === 'object') {
            for (const arr of Object.values(simpleExamples)) {
                if (Array.isArray(arr)) {
                    for (const item of arr) {
                        if (item?.words?.length) {
                            const text = item.words.join('').trim();
                            if (text && !examples.includes(text))
                                examples.push(text);
                        }
                    }
                }
            }
        }
        if (examples.length === 0) {
            const partOfSpeechReps = firstWord.partOfSpeechRepresentitives as
                | Record<string, { examples?: { example?: string }[] }>
                | undefined;
            if (partOfSpeechReps && typeof partOfSpeechReps === 'object') {
                for (const posValue of Object.values(partOfSpeechReps)) {
                    const exArr = posValue?.examples;
                    if (Array.isArray(exArr)) {
                        for (const ex of exArr) {
                            const text = (
                                ex as { example?: string }
                            )?.example?.trim();
                            if (text && !examples.includes(text))
                                examples.push(text);
                        }
                    }
                }
            }
        }

        return {
            word,
            meaning,
            partOfSpeech,
            pronunciation,
            audioUrl,
            examples,
        };
    }

    async getWordExamples(word: string): Promise<string[]> {
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

                const meaningArr = items
                    .map((item) =>
                        item.localizedProperties?.translation
                            ?.trim()
                            .replaceAll(',', ', '),
                    )
                    .filter((m): m is string => m != null && m !== '');

                if (meaningArr.length === 0) continue;

                const meaning = [
                    ...new Set(
                        meaningArr
                            .join(',')
                            .split(',')
                            .map((s) => s.trim()),
                    ),
                ].join(', ');

                const imageUrl =
                    items.find((item) => item.wordPhoto?.photo)?.wordPhoto
                        ?.photo ?? '';

                results.push({
                    langeekWordId: entry.id,
                    word: entry.entry,
                    partOfSpeech,
                    meaning,
                    imageUrl,
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
    ): Promise<
        {
            id: string;
            word: string;
            meaning: string;
            partOfSpeech: string | null;
            imageUrl: string | null;
            lessonId: string;
            lessonName: string;
            courseId: string;
            courseName: string;
        }[]
    > {
        if (!searchTerm?.trim()) {
            return [];
        }
        const term = searchTerm.trim();
        const words = await this.prisma.word.findMany({
            where: {
                lesson: {
                    course: { userLoginId },
                },
                OR: [
                    { word: { contains: term, mode: 'insensitive' } },
                    { meaning: { contains: term, mode: 'insensitive' } },
                ],
            },
            take: Math.min(limit, 100),
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
    }
}
