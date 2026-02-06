import { Controller, Get, Param } from '@nestjs/common';
import { WordsService } from './words.service';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@ApiTags('dictionary')
@Controller('words')
export class WordsController {
    constructor(private readonly wordsService: WordsService) {}

    @Get('pronunciation/:word')
    @ApiOperation({
        summary: 'Get pronunciation for a word',
        description:
            'Fetches pronunciation information from dictionary for a given word',
    })
    @ApiParam({
        name: 'word',
        description:
            'Word to get pronunciation for (letters, spaces, hyphens, apostrophes only)',
        example: 'hello',
    })
    @ApiResponse({
        status: 200,
        description: 'Pronunciation data retrieved successfully',
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid word format',
    })
    @ApiResponse({
        status: 404,
        description: 'Word not found in dictionary',
    })
    async getPronunciation(@Param('word') word: string) {
        return this.wordsService.getPronunciation(word);
    }
}
