import { InternalServiceGuard } from '@/guard/internal-service/internal-service.guard';
import {
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DictionaryService } from './dictionary.service';
import {
    DictionarySearchResultDto,
    UserWordSearchResultDto,
} from './dto/dictionary.dto';

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
