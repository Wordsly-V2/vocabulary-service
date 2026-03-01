import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { DictionaryScraper } from '@perqueza72/cambridge-dictionary-scraper';
import { firstValueFrom } from 'rxjs';
import type {
    DictionarySearchResultDto,
    LangeekWordEntryDto,
} from './dto/dictionary.dto';
import { PrismaService } from '@/prisma/prisma.service';
import * as cheerio from 'cheerio';

// Initialize the Cambridge Dictionary scraper
const dictionary = new DictionaryScraper();
const baseCambridgeUrl = 'https://dictionary.cambridge.org';

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
