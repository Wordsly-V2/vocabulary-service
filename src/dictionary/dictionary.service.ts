import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { DictionaryScraper } from '@perqueza72/cambridge-dictionary-scraper';
import { firstValueFrom } from 'rxjs';
import type {
    DictionarySearchResultDto,
    LangeekWordEntryDto,
} from './dto/dictionary.dto';
import { PrismaService } from '@/prisma/prisma.service';

// Initialize the Cambridge Dictionary scraper
const dictionary = new DictionaryScraper();
const baseCambridgeUrl = 'https://dictionary.cambridge.org';

@Injectable()
export class DictionaryService {
    constructor(
        private readonly httpService: HttpService,
        private readonly prisma: PrismaService,
    ) {}

    async getWordPronunciation(word: string): Promise<
        {
            type: string;
            url: string;
        }[]
    > {
        try {
            const pronunciation = await dictionary.pronounciation(word);
            const results = pronunciation.map((item) => {
                item.url = baseCambridgeUrl + item.url;
                return item;
            });
            return results;
        } catch {
            return [];
        }
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
