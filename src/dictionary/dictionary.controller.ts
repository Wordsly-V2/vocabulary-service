import { InternalServiceGuard } from '@/guard/internal-service/internal-service.guard';
import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    ParseUUIDPipe,
    UseGuards,
} from '@nestjs/common';
import {
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import type { LangeekWordDetailsResult } from './dictionary.service';
import { DictionaryService } from './dictionary.service';
import {
    DictionarySearchResultDto,
    LangeekWordDetailsDto,
    UserWordSearchResultDto,
} from './dto/dictionary.dto';

@ApiTags('dictionary')
@Controller('dictionary')
@UseGuards(InternalServiceGuard)
export class DictionaryController {
    constructor(private readonly dictionaryService: DictionaryService) {}

    @Get('pronunciation/:word')
    @ApiOperation({
        summary: 'Get pronunciation and IPA for a word',
        description:
            'Fetches pronunciation (audio URLs) and UK/US IPA from dictionary for a given word',
    })
    @ApiParam({
        name: 'word',
        description:
            'Word to get pronunciation for (letters, spaces, hyphens, apostrophes only)',
        example: 'hello',
    })
    @ApiResponse({
        status: 200,
        description: 'Pronunciation and IPA data',
        schema: {
            type: 'object',
            properties: {
                pronunciation: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            type: { type: 'string' },
                            url: { type: 'string' },
                        },
                    },
                },
                ipas: {
                    type: 'object',
                    properties: {
                        uk: { type: 'string', nullable: true },
                        us: { type: 'string', nullable: true },
                    },
                },
            },
        },
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

    @Get('word-details/:langeekWordId')
    @ApiOperation({
        summary: 'Get word details from Langeek dictionary',
        description:
            'Fetches full word details from dictionary.langeek.co using the word ID from search results. The build ID is obtained by crawling the dictionary site.',
    })
    @ApiParam({
        name: 'langeekWordId',
        description: 'Langeek word entry ID (from search results)',
        example: 2707,
    })
    @ApiQuery({
        name: 'entry',
        description:
            'Word text (e.g. from search result), required for the Langeek URL',
        example: 'admire',
    })
    @ApiResponse({
        status: 200,
        description:
            'Structured word details (word, meaning, partOfSpeech, pronunciation, audioUrl, examples)',
        type: LangeekWordDetailsDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Word details not found',
    })
    async getLangeekWordDetails(
        @Param('langeekWordId', new ParseIntPipe()) langeekWordId: number,
    ): Promise<LangeekWordDetailsResult | null> {
        return this.dictionaryService.getLangeekWordDetails(langeekWordId);
    }

    @Get('examples/:word')
    @ApiOperation({
        summary: 'Get examples for a word',
        description: 'Gets examples for a word from the dictionary',
    })
    @ApiParam({
        name: 'word',
        description: 'Word to get examples for',
    })
    @ApiResponse({
        status: 200,
        description: 'Examples retrieved successfully',
        type: [String],
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid word format',
    })
    async getWordExamples(@Param('word') word: string): Promise<string[]> {
        return this.dictionaryService.getWordExamples(word);
    }

    @Get('users/:userLoginId/words/search/:word')
    @ApiOperation({
        summary: 'Search user-created words',
        description:
            'Searches words the user created across all their courses. Matches the search term against word and meaning (case-insensitive).',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User identifier',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    @ApiParam({
        name: 'word',
        description: 'Word to search for',
        example: 'hello',
    })
    @ApiResponse({
        status: 200,
        description: 'Matching user-created words',
        type: [UserWordSearchResultDto],
    })
    async searchUserWords(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('word') word: string,
    ): Promise<UserWordSearchResultDto[]> {
        return this.dictionaryService.searchUserWords(userLoginId, word);
    }
}
