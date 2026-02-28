import { InternalServiceGuard } from '@/guard/internal-service/internal-service.guard';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Word } from '@prisma/client';
import { CourseLessonWordsService } from './course-lesson-words.service';
import {
    BulkDeleteWordsDto,
    BulkMoveWordsDto,
    BulkOperationResponseDto,
    CreateWordDto,
    DeleteResponseDto,
    MoveWordDto,
    UpdateWordDto,
    WordResponseDto,
} from './dto/word.dto';

@ApiTags('words')
@Controller('users/:userLoginId/courses/:courseId/lessons/:lessonId/words')
@ApiParam({
    name: 'userLoginId',
    description: 'User login ID',
    example: '01936c1e-1234-7890-abcd-ef1234567890',
})
@ApiParam({
    name: 'courseId',
    description: 'Course ID',
    example: '01936c1e-1234-7890-abcd-ef1234567890',
})
@ApiParam({
    name: 'lessonId',
    description: 'Lesson ID',
    example: '01936c1e-1234-7890-abcd-ef1234567890',
})
@UseGuards(InternalServiceGuard)
export class CourseLessonWordsController {
    constructor(private readonly wordsService: CourseLessonWordsService) {}

    @Post()
    @ApiOperation({
        summary: 'Create a new word',
        description: 'Creates a new word within a lesson',
    })
    @ApiBody({ type: CreateWordDto })
    @ApiResponse({
        status: 201,
        description: 'Word created successfully',
        type: WordResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data',
    })
    @ApiResponse({
        status: 404,
        description: 'Lesson not found',
    })
    @ApiResponse({
        status: 400,
        description:
            'Lesson has reached its maximum word limit (maxWords per lesson)',
    })
    async createWord(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
        @Body() createWordDto: CreateWordDto,
    ): Promise<Word> {
        return this.wordsService.createWord(
            userLoginId,
            courseId,
            lessonId,
            createWordDto,
        );
    }

    @Post('bulk')
    @ApiOperation({
        summary: 'Create multiple words',
        description: 'Creates multiple words within a lesson in bulk',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                words: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/CreateWordDto' },
                },
            },
        },
    })
    @ApiResponse({
        status: 201,
        description: 'Words created successfully',
        type: BulkOperationResponseDto,
    })
    @ApiResponse({
        status: 400,
        description:
            'Invalid input data or lesson would exceed maxWords per lesson',
    })
    async createWordsBulk(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
        @Body() payload: { words: CreateWordDto[] },
    ): Promise<{ count: number }> {
        return this.wordsService.createWordsBulk(
            userLoginId,
            courseId,
            lessonId,
            payload.words,
        );
    }

    @Get(':wordId')
    @ApiOperation({
        summary: 'Get word by ID',
        description: 'Retrieves a specific word by its ID',
    })
    @ApiParam({
        name: 'wordId',
        description: 'Word ID',
        example: 'word-uuid-123',
    })
    @ApiResponse({
        status: 200,
        description: 'Word retrieved successfully',
        type: WordResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Word not found',
    })
    async getWordById(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
        @Param('wordId', new ParseUUIDPipe()) wordId: string,
    ): Promise<Word> {
        return this.wordsService.getWordById(
            userLoginId,
            courseId,
            lessonId,
            wordId,
        );
    }

    @Put('bulk-move')
    @ApiOperation({
        summary: 'Move multiple words to another lesson',
        description:
            'Moves multiple words from the current lesson to a target lesson in bulk. The target lesson can be in the same course or in any other course owned by the user.',
    })
    @ApiBody({ type: BulkMoveWordsDto })
    @ApiResponse({
        status: 200,
        description: 'Words moved successfully',
        type: BulkOperationResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Target lesson not found',
    })
    @ApiResponse({
        status: 400,
        description:
            'Target lesson would exceed its maximum word limit (maxWords)',
    })
    async moveWordsBulk(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
        @Body() bulkMoveWordsDto: BulkMoveWordsDto,
    ): Promise<{ count: number }> {
        return this.wordsService.moveWordsBulk(
            userLoginId,
            courseId,
            lessonId,
            bulkMoveWordsDto.wordIds,
            bulkMoveWordsDto.targetLessonId,
        );
    }

    @Put(':wordId')
    @ApiOperation({
        summary: 'Update a word',
        description: 'Updates an existing word',
    })
    @ApiParam({
        name: 'wordId',
        description: 'Word ID',
        example: 'word-uuid-123',
    })
    @ApiBody({ type: UpdateWordDto })
    @ApiResponse({
        status: 200,
        description: 'Word updated successfully',
        type: WordResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Word not found',
    })
    async updateWord(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
        @Param('wordId', new ParseUUIDPipe()) wordId: string,
        @Body() updateWordDto: UpdateWordDto,
    ): Promise<Word> {
        return this.wordsService.updateWord(
            userLoginId,
            courseId,
            lessonId,
            wordId,
            updateWordDto,
        );
    }

    @Delete('bulk-delete')
    @ApiOperation({
        summary: 'Delete multiple words',
        description: 'Deletes multiple words from a lesson in bulk',
    })
    @ApiBody({ type: BulkDeleteWordsDto })
    @ApiResponse({
        status: 200,
        description: 'Words deleted successfully',
        type: BulkOperationResponseDto,
    })
    async deleteWordsBulk(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
        @Body() bulkDeleteWordsDto: BulkDeleteWordsDto,
    ): Promise<{ count: number }> {
        return this.wordsService.deleteWordsBulk(
            userLoginId,
            courseId,
            lessonId,
            bulkDeleteWordsDto.wordIds,
        );
    }

    @Delete(':wordId')
    @ApiOperation({
        summary: 'Delete a word',
        description: 'Deletes a word from a lesson',
    })
    @ApiParam({
        name: 'wordId',
        description: 'Word ID',
        example: 'word-uuid-123',
    })
    @ApiResponse({
        status: 200,
        description: 'Word deleted successfully',
        type: DeleteResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Word not found',
    })
    async deleteWord(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
        @Param('wordId', new ParseUUIDPipe()) wordId: string,
    ): Promise<{ success: boolean }> {
        await this.wordsService.deleteWord(
            userLoginId,
            courseId,
            lessonId,
            wordId,
        );
        return { success: true };
    }

    @Put(':wordId/move')
    @ApiOperation({
        summary: 'Move a word to another lesson',
        description:
            'Moves a word from the current lesson to a target lesson. The target lesson can be in the same course or in any other course owned by the user.',
    })
    @ApiParam({
        name: 'wordId',
        description: 'Word ID',
        example: 'word-uuid-123',
    })
    @ApiBody({ type: MoveWordDto })
    @ApiResponse({
        status: 200,
        description: 'Word moved successfully',
        type: WordResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Word or target lesson not found',
    })
    @ApiResponse({
        status: 400,
        description:
            'Target lesson has reached its maximum word limit (maxWords)',
    })
    async moveWord(
        @Param('userLoginId', new ParseUUIDPipe()) userLoginId: string,
        @Param('courseId', new ParseUUIDPipe()) courseId: string,
        @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
        @Param('wordId', new ParseUUIDPipe()) wordId: string,
        @Body() moveWordDto: MoveWordDto,
    ): Promise<Word> {
        return this.wordsService.moveWord(
            userLoginId,
            courseId,
            lessonId,
            wordId,
            moveWordDto.targetLessonId,
        );
    }
}
