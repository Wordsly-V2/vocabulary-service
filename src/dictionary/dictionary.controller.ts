import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { DictionaryService } from './dictionary.service';
import { DictionarySearchResultDto } from './dto/dictionary.dto';
import { InternalServiceGuard } from '@/guard/internal-service/internal-service.guard';

@ApiTags('dictionary')
@Controller('dictionary')
@UseGuards(InternalServiceGuard)
export class DictionaryController {
    constructor(private readonly dictionaryService: DictionaryService) {}

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
    async getWordPronunciation(@Param('word') word: string) {
        return this.dictionaryService.getWordPronunciation(word);
    }

    @Get('search/:word')
    @ApiOperation({
        summary: 'Search for words',
        description: 'Searches for words in the dictionary',
    })
    @ApiParam({
        name: 'word',
        description: 'Word to search for',
    })
    @ApiResponse({
        status: 200,
        description: 'Words searched successfully',
        type: [DictionarySearchResultDto],
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid word format',
    })
    async searchWords(@Param('word') word: string) {
        return this.dictionaryService.searchWords(word);
    }
}
