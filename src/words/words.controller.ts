import { Controller, Get, Param } from '@nestjs/common';
import { WordsService } from './words.service';

@Controller('words')
export class WordsController {
    constructor(private readonly wordsService: WordsService) {}

    // Dictionary endpoint (independent of user/course/lesson)
    @Get('pronunciation/:word')
    async getPronunciation(@Param('word') word: string) {
        return this.wordsService.getPronunciation(word);
    }
}
