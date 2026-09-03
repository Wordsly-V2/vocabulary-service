import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Word } from '@prisma/client';
import {
    ByCourseIdsDto,
    ByLessonIdsDto,
    FilterOwnedWordIdsDto,
    FilterOwnedWordIdsResponseDto,
    ScopedWordIdsQueryDto,
    ScopedWordIdsResponseDto,
    WordAccessResponseDto,
    WordScopeGroupDto,
} from './dto/word-scope.dto';
import { WordScopeService } from './word-scope.service';

@ApiTags('users/:userLoginId/words')
@Controller('users/:userLoginId/words')
@ApiParam({
    name: 'userLoginId',
    description: 'User login ID',
})
export class WordScopeController {
    constructor(private readonly wordScopeService: WordScopeService) {}

    @Get('scoped-ids')
    @ApiOperation({
        summary: 'Get word IDs in user scope',
        description:
            'Returns word IDs ordered by lesson index then word, optionally filtered by course or lesson.',
    })
    @ApiResponse({ status: 200, type: ScopedWordIdsResponseDto })
    async getScopedWordIds(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Query() query: ScopedWordIdsQueryDto,
    ): Promise<ScopedWordIdsResponseDto> {
        const wordIds = await this.wordScopeService.getScopedWordIds(
            userLoginId,
            query.courseId,
            query.lessonId,
        );
        return { wordIds };
    }

    @Get(':wordId/has-access')
    @ApiOperation({ summary: 'Check if user owns a word' })
    @ApiResponse({ status: 200, type: WordAccessResponseDto })
    async hasWordAccess(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('wordId', new ParseUUIDPipe()) wordId: string,
    ): Promise<WordAccessResponseDto> {
        const hasAccess = await this.wordScopeService.hasWordAccess(
            userLoginId,
            wordId,
        );
        return { hasAccess };
    }

    @Post('filter-owned')
    @ApiOperation({
        summary: 'Filter word IDs to those owned by the user',
    })
    @ApiResponse({ status: 200, type: FilterOwnedWordIdsResponseDto })
    async filterOwnedWordIds(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Body() body: FilterOwnedWordIdsDto,
    ): Promise<FilterOwnedWordIdsResponseDto> {
        const wordIds = await this.wordScopeService.filterOwnedWordIds(
            userLoginId,
            body.wordIds,
        );
        return { wordIds };
    }

    @Post('hydrate-by-ids')
    @ApiOperation({
        summary: 'Get full word details for owned word IDs across any course',
    })
    async getWordsByIds(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Body() body: FilterOwnedWordIdsDto,
    ): Promise<Word[]> {
        return this.wordScopeService.getWordsByIds(userLoginId, body.wordIds);
    }

    @Post('group-by-lesson-ids')
    @ApiOperation({
        summary: 'Group word IDs by lesson',
    })
    async groupByLessonIds(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Body() body: ByLessonIdsDto,
    ): Promise<Record<string, WordScopeGroupDto>> {
        return this.wordScopeService.groupByLessonIds(
            userLoginId,
            body.lessonIds,
        );
    }

    @Post('group-by-course-ids')
    @ApiOperation({
        summary: 'Group word IDs by course',
    })
    async groupByCourseIds(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Body() body: ByCourseIdsDto,
    ): Promise<Record<string, WordScopeGroupDto>> {
        return this.wordScopeService.groupByCourseIds(
            userLoginId,
            body.courseIds,
        );
    }
}
