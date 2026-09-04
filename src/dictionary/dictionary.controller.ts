import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
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
    SyncJobStatusDto,
    SyncWordsLangeekDto,
    UserWordSearchResultDto,
    WordPronunciationResponseDto,
} from './dto/dictionary.dto';
import { CurrentUser } from '@/auth/jwt/current-user.decorator';

@ApiTags('dictionary')
@Controller('dictionary')
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

    @Get('words/search/:word')
    @ApiOperation({
        summary: 'Search user-created words',
        description:
            'Searches words the user created across all their courses. Matches the search term against word and meaning (case-insensitive).',
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
        @CurrentUser() userLoginId: string,
        @Param('word') word: string,
    ): Promise<UserWordSearchResultDto[]> {
        return this.dictionaryService.searchUserWords(userLoginId, word);
    }

    @Post('sync-words-langeek')
    @ApiOperation({
        summary: "Sync this user's words with Langeek",
        description:
            'Counts the words matching the filters, records a job, then produces one Kafka message per word. This service consumes those messages itself (Langeek lookup + DB update). Poll the returned jobId for progress.',
    })
    @ApiResponse({
        status: 201,
        description:
            'Sync job created (jobId to poll progress, total, enqueued)',
    })
    async syncWordsWithLangeek(
        @CurrentUser() userLoginId: string,
        @Body() dto: SyncWordsLangeekDto,
    ): Promise<{ jobId: string; total: number; enqueued: number }> {
        // The user comes from the access token, never from the body. The DTO
        // no longer offers a `userId` to be tempted by, and UserScopeGuard
        // refuses a request that tries to name one.
        return this.dictionaryService.syncWordsWithLangeek({
            userId: userLoginId,
            courseId: dto.courseId,
            lessonId: dto.lessonId,
            wordId: dto.wordId,
        });
    }

    @Get('sync-words-langeek/jobs/:jobId')
    @ApiOperation({
        summary: 'Get sync job progress (internal)',
        description:
            'Returns how many words are done/remaining and whether the job is still in progress or completed.',
    })
    @ApiParam({ name: 'jobId', description: 'Sync job identifier' })
    @ApiResponse({
        status: 200,
        description: 'Sync job progress',
        type: SyncJobStatusDto,
    })
    @ApiResponse({ status: 404, description: 'Job not found' })
    async getSyncJob(
        @CurrentUser() userLoginId: string,
        @Param('jobId', new ParseUUIDPipe()) jobId: string,
    ): Promise<SyncJobStatusDto> {
        const job = await this.dictionaryService.getSyncJob(jobId, userLoginId);
        if (!job) {
            throw new NotFoundException('Sync job not found');
        }
        return job;
    }
}
