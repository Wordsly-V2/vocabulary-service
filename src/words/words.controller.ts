import { Controller, Get, Param } from '@nestjs/common';
import { WordsService } from './words.service';

@Controller('words')
export class WordsController {
    constructor(private readonly wordsService: WordsService) {}

    @Get('pronunciation/:word')
    async getPronunciation(@Param('word') word: string) {
        return this.wordsService.getPronunciation(word);
    }
}
