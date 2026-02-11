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
            return this.mapToSearchResults(entries);
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
                if (!Array.isArray(items) || items.length === 0) continue;

                const meanings = items
                    .map((item) =>
                        item.localizedProperties?.translation?.trim(),
                    )
                    .filter((m): m is string => m != null && m !== '');

                const imageUrl =
                    items.find((item) => item.wordPhoto?.photo)?.wordPhoto
                        ?.photo ?? '';

                results.push({
                    word: entry.entry,
                    partOfSpeech,
                    meaning: meanings.join(','),
                    imageUrl,
                });
            }
        }
        return results;
    }
}
