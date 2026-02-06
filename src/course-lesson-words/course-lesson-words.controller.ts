import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
} from '@nestjs/common';
import { Word } from '@prisma/client';
import { CourseLessonWordsService } from './course-lesson-words.service';
import {
    BulkDeleteWordsDto,
    BulkMoveWordsDto,
    CreateWordDto,
    MoveWordDto,
    UpdateWordDto,
} from './dto/word.dto';

@Controller('users/:userLoginId/courses/:courseId/lessons/:lessonId/words')
export class CourseLessonWordsController {
    constructor(private readonly wordsService: CourseLessonWordsService) {}

    // Words CRUD (nested under lessons)
    @Post()
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
