import { Injectable } from '@nestjs/common';
import { DictionaryScraper } from '@perqueza72/cambridge-dictionary-scraper';

// Initialize the Cambridge Dictionary scraper
const dictionary = new DictionaryScraper();
export const baseCambridgeUrl = 'https://dictionary.cambridge.org';

@Injectable()
export class DictionaryService {
    async getWordPronunciation(word: string): Promise<
        {
            type: string;
            url: string;
        }[]
    > {
        const pronunciation = await dictionary.pronounciation(word);
        return pronunciation;
    }
}
