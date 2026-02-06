import { InternalServiceGuard } from '@/guard/internal-service/internal-service.guard';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
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
    CreateWordDto,
    MoveWordDto,
    UpdateWordDto,
} from './dto/word.dto';

@ApiTags('words')
@Controller('users/:userLoginId/courses/:courseId/lessons/:lessonId/words')
@UseGuards(InternalServiceGuard)
export class CourseLessonWordsController {
    constructor(private readonly wordsService: CourseLessonWordsService) {}

    @Post()
    @ApiOperation({
        summary: 'Create a new word',
        description: 'Creates a new word within a lesson',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiParam({
        name: 'lessonId',
        description: 'Lesson ID',
        example: 'lesson-uuid-123',
    })
    @ApiBody({ type: CreateWordDto })
    @ApiResponse({
        status: 201,
        description: 'Word created successfully',
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data',
    })
    @ApiResponse({
        status: 404,
        description: 'Lesson not found',
    })
    async createWord(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
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
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiParam({
        name: 'lessonId',
        description: 'Lesson ID',
        example: 'lesson-uuid-123',
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
        schema: {
            type: 'object',
            properties: {
                count: { type: 'number', example: 5 },
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data',
    })
    async createWordsBulk(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
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
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiParam({
        name: 'lessonId',
        description: 'Lesson ID',
        example: 'lesson-uuid-123',
    })
    @ApiParam({
        name: 'wordId',
        description: 'Word ID',
        example: 'word-uuid-123',
    })
    @ApiResponse({
        status: 200,
        description: 'Word retrieved successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'Word not found',
    })
    async getWordById(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @Param('wordId') wordId: string,
    ): Promise<Word> {
        return this.wordsService.getWordById(
            userLoginId,
            courseId,
            lessonId,
            wordId,
        );
    }

    @Put(':wordId')
    @ApiOperation({
        summary: 'Update a word',
        description: 'Updates an existing word',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiParam({
        name: 'lessonId',
        description: 'Lesson ID',
        example: 'lesson-uuid-123',
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
    })
    @ApiResponse({
        status: 404,
        description: 'Word not found',
    })
    async updateWord(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @Param('wordId') wordId: string,
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

    @Delete(':wordId')
    @ApiOperation({
        summary: 'Delete a word',
        description: 'Deletes a word from a lesson',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiParam({
        name: 'lessonId',
        description: 'Lesson ID',
        example: 'lesson-uuid-123',
    })
    @ApiParam({
        name: 'wordId',
        description: 'Word ID',
        example: 'word-uuid-123',
    })
    @ApiResponse({
        status: 200,
        description: 'Word deleted successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Word not found',
    })
    async deleteWord(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @Param('wordId') wordId: string,
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
        description: 'Moves a word from the current lesson to a target lesson',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiParam({
        name: 'lessonId',
        description: 'Source lesson ID',
        example: 'lesson-uuid-123',
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
    })
    @ApiResponse({
        status: 404,
        description: 'Word or target lesson not found',
    })
    async moveWord(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @Param('wordId') wordId: string,
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

    @Put('bulk-move')
    @ApiOperation({
        summary: 'Move multiple words to another lesson',
        description:
            'Moves multiple words from the current lesson to a target lesson in bulk',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiParam({
        name: 'lessonId',
        description: 'Source lesson ID',
        example: 'lesson-uuid-123',
    })
    @ApiBody({ type: BulkMoveWordsDto })
    @ApiResponse({
        status: 200,
        description: 'Words moved successfully',
        schema: {
            type: 'object',
            properties: {
                count: { type: 'number', example: 5 },
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Target lesson not found',
    })
    async moveWordsBulk(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
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

    @Delete('bulk-delete')
    @ApiOperation({
        summary: 'Delete multiple words',
        description: 'Deletes multiple words from a lesson in bulk',
    })
    @ApiParam({
        name: 'userLoginId',
        description: 'User login ID',
        example: 'user123',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID',
        example: 'course-uuid-123',
    })
    @ApiParam({
        name: 'lessonId',
        description: 'Lesson ID',
        example: 'lesson-uuid-123',
    })
    @ApiBody({ type: BulkDeleteWordsDto })
    @ApiResponse({
        status: 200,
        description: 'Words deleted successfully',
        schema: {
            type: 'object',
            properties: {
                count: { type: 'number', example: 5 },
            },
        },
    })
    async deleteWordsBulk(
        @Param('userLoginId') userLoginId: string,
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @Body() bulkDeleteWordsDto: BulkDeleteWordsDto,
    ): Promise<{ count: number }> {
        return this.wordsService.deleteWordsBulk(
            userLoginId,
            courseId,
            lessonId,
            bulkDeleteWordsDto.wordIds,
        );
    }
}
