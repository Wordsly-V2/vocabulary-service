import { DictionaryService } from '@/dictionary/dictionary.service';
import { Injectable } from '@nestjs/common';

const baseCambridgeUrl = 'https://dictionary.cambridge.org';

@Injectable()
export class WordsService {
    constructor(private readonly dictionaryService: DictionaryService) {}

    async getPronunciation(word: string) {
        const pronunciations =
            await this.dictionaryService.getWordPronunciation(word);

        const results = pronunciations.map((pronunciation) => {
            pronunciation.url = baseCambridgeUrl + pronunciation.url;
            return pronunciation;
        });

        return results;
    }
}
