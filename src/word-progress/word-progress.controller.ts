import { InternalServiceGuard } from '@/guard/internal-service/internal-service.guard';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import {
    BulkRecordAnswersDto,
    DueWordDto,
    DueWordIdsResponseDto,
    GetDueWordsQueryDto,
    RecordAnswerDto,
    WordProgressResponseDto,
    WordProgressStatsDto,
    WordProgressStatsQueryDto,
} from './dto/word-progress.dto';
import { WordProgressService } from './word-progress.service';

@ApiTags('users/:userLoginId/word-progress')
@Controller('users/:userLoginId/word-progress')
@ApiParam({
    name: 'userLoginId',
    description: 'User login ID',
    example: '01936c1e-1234-7890-abcd-ef1234567890',
})
@UseGuards(InternalServiceGuard)
export class WordProgressController {
    constructor(private readonly wordProgressService: WordProgressService) {}

    @Post('record-answer')
    @ApiOperation({
        summary: 'Record an answer for a word',
        description:
            "Records the user's answer quality and updates the spaced repetition schedule using SM-2 algorithm",
    })
    @ApiBody({ type: RecordAnswerDto })
    @ApiResponse({
        status: 200,
        description: 'Answer recorded successfully',
        type: WordProgressResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Word not found or access denied',
    })
    async recordAnswer(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Body() recordAnswerDto: RecordAnswerDto,
    ): Promise<WordProgressResponseDto> {
        return this.wordProgressService.recordAnswer(
            userLoginId,
            recordAnswerDto,
        );
    }

    @Post('record-answers')
    @ApiOperation({
        summary: 'Record multiple answers in bulk',
        description:
            'Records multiple word answers at once for better performance',
    })
    @ApiBody({ type: BulkRecordAnswersDto })
    @ApiResponse({
        status: 200,
        description: 'Answers recorded successfully',
        type: [WordProgressResponseDto],
    })
    async recordAnswers(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Body() bulkRecordAnswersDto: BulkRecordAnswersDto,
    ): Promise<WordProgressResponseDto[]> {
        return this.wordProgressService.recordAnswers(
            userLoginId,
            bulkRecordAnswersDto.answers,
        );
    }

    @Get('due-words')
    @ApiOperation({
        summary: 'Get words due for review',
        description:
            'Retrieves words that are due for review based on spaced repetition algorithm. Returns a mix of overdue words and new words.',
    })
    @ApiQuery({
        name: 'courseId',
        required: false,
        type: String,
        description: 'Filter by specific course',
    })
    @ApiQuery({
        name: 'lessonId',
        required: false,
        type: String,
        description: 'Filter by specific lesson',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Maximum number of words to return (1-100)',
        example: 20,
    })
    @ApiQuery({
        name: 'includeNew',
        required: false,
        type: Boolean,
        description: 'Include new words not yet reviewed',
        example: true,
    })
    @ApiResponse({
        status: 200,
        description: 'Due words retrieved successfully',
        type: [DueWordDto],
    })
    async getDueWords(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Query() query: GetDueWordsQueryDto,
    ): Promise<DueWordDto[]> {
        return this.wordProgressService.getDueWords(userLoginId, query);
    }

    @Get('due-word-ids')
    @ApiOperation({
        summary: 'Get IDs of words due for review',
        description:
            'Same as due-words but returns only a list of word IDs. Uses the same filters (courseId, lessonId, limit, includeNew) and ordering.',
    })
    @ApiQuery({
        name: 'courseId',
        required: false,
        type: String,
        description: 'Filter by specific course',
    })
    @ApiQuery({
        name: 'lessonId',
        required: false,
        type: String,
        description: 'Filter by specific lesson',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Maximum number of word IDs to return (1-100)',
        example: 20,
    })
    @ApiQuery({
        name: 'includeNew',
        required: false,
        type: Boolean,
        description: 'Include new words not yet reviewed',
        example: true,
    })
    @ApiResponse({
        status: 200,
        description: 'Due word IDs retrieved successfully',
        type: DueWordIdsResponseDto,
    })
    async getDueWordIds(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Query() query: GetDueWordsQueryDto,
    ): Promise<DueWordIdsResponseDto> {
        const wordIds = await this.wordProgressService.getDueWordIds(
            userLoginId,
            query,
        );
        return { wordIds };
    }

    @Get('stats')
    @ApiOperation({
        summary: 'Get learning progress statistics',
        description:
            "Retrieves comprehensive statistics about the user's learning progress including new, learning, and review words",
    })
    @ApiQuery({
        name: 'courseId',
        required: false,
        type: String,
        description: 'Filter by specific course',
    })
    @ApiQuery({
        name: 'lessonId',
        required: false,
        type: String,
        description: 'Filter by specific lesson',
    })
    @ApiResponse({
        status: 200,
        description: 'Statistics retrieved successfully',
        type: WordProgressStatsDto,
    })
    async getProgressStats(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Query() query: WordProgressStatsQueryDto,
    ): Promise<WordProgressStatsDto> {
        return this.wordProgressService.getProgressStats(
            userLoginId,
            query.courseId,
            query.lessonId,
        );
    }

    @Get('words/:wordId')
    @ApiOperation({
        summary: 'Get progress for a specific word',
        description:
            'Retrieves the learning progress details for a single word',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'wordId',
        description: 'Word ID',
        example: '01936b3e-7c8f-7890-abcd-ef1234567890',
    })
    @ApiResponse({
        status: 200,
        description: 'Word progress retrieved successfully',
        type: WordProgressResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Progress not found for this word',
    })
    async getWordProgress(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('wordId') wordId: string,
    ): Promise<WordProgressResponseDto | null> {
        return this.wordProgressService.getWordProgress(userLoginId, wordId);
    }

    @Delete('words/:wordId/reset')
    @ApiOperation({
        summary: 'Reset progress for a specific word',
        description:
            'Deletes all learning progress for a word, allowing the user to start fresh',
    })
    @ApiParam({
        name: 'wordId',
        description: 'Word ID',
        example: '01936b3e-7c8f-7890-abcd-ef1234567890',
    })
    @ApiResponse({
        status: 200,
        description: 'Progress reset successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'Word not found or access denied',
    })
    async resetProgress(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('wordId', new ParseUUIDPipe()) wordId: string,
    ): Promise<{ success: boolean }> {
        await this.wordProgressService.resetProgress(userLoginId, wordId);
        return { success: true };
    }
}
