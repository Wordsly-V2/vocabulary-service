import { InternalServiceGuard } from '@/guard/internal-service/internal-service.guard';
import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { DictionaryService } from './dictionary.service';
import {
    DictionarySearchResultDto,
    LangeekFilter,
    LangeekWordDetailsDto,
    SyncWordsLangeekDto,
    UserWordSearchResultDto,
    WordPronunciationResponseDto,
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
        type: WordPronunciationResponseDto,
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
    @ApiQuery({
        name: 'filters',
        description: 'Filters to apply to the search',
        example: ['withExamples', 'inCategory', 'photo'],
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
    async searchWords(
        @Param('word') word: string,
        @Query('filters') filters: LangeekFilter[] = [],
    ) {
        return this.dictionaryService.searchWords(word, filters);
    }

    @Get('word-details/:word/:partOfSpeech')
    @ApiOperation({
        summary: 'Get word details from Langeek dictionary',
        description:
            'Fetches full word details from dictionary.langeek.co. When partOfSpeech is provided (e.g. adjective, noun, verb), returns the matching sense for words with multiple meanings.',
    })
    @ApiParam({
        name: 'word',
        description: 'Word to get details for',
        example: 'hello',
    })
    @ApiParam({
        name: 'partOfSpeech',
        description:
            'Optional. Part of speech to select (e.g. adjective, noun, verb) when the word has multiple senses.',
        example: 'adjective',
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
        @Param('word') word: string,
        @Param('partOfSpeech') partOfSpeech: string,
    ): Promise<LangeekWordDetailsDto | null> {
        return this.dictionaryService.getLangeekWordDetails(word, partOfSpeech);
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

    @Post('sync-words-langeek/words')
    @ApiOperation({
        summary: 'Get words for sync (internal)',
        description:
            'Returns the list of words matching the given filters. Used by the API gateway to produce one Kafka message per word; vocabulary-service only consumes and processes.',
    })
    @ApiResponse({
        status: 200,
        description: 'List of words (wordId, word, partOfSpeech) to sync',
    })
    async getWordsForSync(@Body() dto: SyncWordsLangeekDto) {
        const filters = {
            userId: dto.userId,
            courseId: dto.courseId,
            lessonId: dto.lessonId,
            wordId: dto.wordId,
            cursor: dto.cursor,
            limit: dto.limit,
        };
        return this.dictionaryService.getWordsForSyncFilters(filters);
    }
}
