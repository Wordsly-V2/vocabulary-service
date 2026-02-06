import { DictionaryService } from '@/dictionary/dictionary.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WordsService {
    constructor(private readonly dictionaryService: DictionaryService) {}

    async getPronunciation(word: string) {
        const pronunciation =
            await this.dictionaryService.getWordPronunciation(word);
        return pronunciation;
    }
}
