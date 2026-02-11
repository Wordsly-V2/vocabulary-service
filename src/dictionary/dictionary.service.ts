import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { DictionaryScraper } from '@perqueza72/cambridge-dictionary-scraper';
import { firstValueFrom } from 'rxjs';
import type {
    DictionarySearchResultDto,
    LangeekWordEntryDto,
} from './dto/dictionary.dto';

// Initialize the Cambridge Dictionary scraper
const dictionary = new DictionaryScraper();
const baseCambridgeUrl = 'https://dictionary.cambridge.org';

@Injectable()
export class DictionaryService {
    constructor(private readonly httpService: HttpService) {}

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
            const words = entries
                .filter(
                    (entry) =>
                        entry.translation.partOfSpeech.partOfSpeechType !==
                        'sentence',
                )
                .map((entry) => entry.entry);
            const wordsWithExamples = await this.getWordsWithExamples(words);

            const results = this.mapToSearchResults(entries, wordsWithExamples);
            return results;
        } catch {
            return [];
        }
    }

    private async getWordsWithExamples(
        words: string[],
    ): Promise<{ word: string; examples: string[] }[]> {
        const wordsWithExamples: { word: string; examples: string[] }[] =
            await Promise.all(
                words.map(async (word) => {
                    try {
                        const meanings = await dictionary.meaning(word);
                        return {
                            word: word,
                            examples: meanings.reduce<string[]>((acc, curr) => {
                                acc.push(...curr.ex);
                                return acc;
                            }, []),
                        };
                    } catch {
                        return {
                            word: word,
                            examples: [],
                        };
                    }
                }),
            );

        return wordsWithExamples;
    }

    private mapToSearchResults(
        entries: LangeekWordEntryDto[],
        wordsWithExamples: { word: string; examples: string[] }[],
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

                const meanings = items
                    .map((item) =>
                        item.localizedProperties?.translation?.trim(),
                    )
                    .filter((m): m is string => m != null && m !== '');

                const imageUrl =
                    items.find((item) => item.wordPhoto?.photo)?.wordPhoto
                        ?.photo ?? '';

                const examples =
                    wordsWithExamples.find((word) => word.word === entry.entry)
                        ?.examples ?? [];

                results.push({
                    word: entry.entry,
                    partOfSpeech,
                    meaning: meanings.join(', '),
                    imageUrl,
                    examples,
                });
            }
        }

        return results;
    }
}
