import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Word } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { CreateWordDto, UpdateWordDto } from './dto/word.dto';

@Injectable()
export class CourseLessonWordsService {
    constructor(private readonly prisma: PrismaService) {}

    async createWord(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        payload: CreateWordDto,
    ): Promise<Word> {
        // Verify lesson exists and belongs to user
        const lesson = await this.prisma.lesson.findUnique({
            where: {
                id: lessonId,
                course: { userLoginId: userLoginId, id: courseId },
            },
        });

        if (!lesson) {
            throw new NotFoundException('Lesson not found');
        }

        return this.prisma.word.create({
            data: {
                id: uuidv7(),
                word: payload.word,
                meaning: payload.meaning,
                pronunciation: payload.pronunciation,
                partOfSpeech: payload.partOfSpeech,
                audioUrl: payload.audioUrl,
                lessonId: lessonId,
            },
        });
    }

    async createWordsBulk(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        words: CreateWordDto[],
    ): Promise<{ count: number }> {
        // Verify lesson exists
        const lesson = await this.prisma.lesson.findUnique({
            where: {
                id: lessonId,
                course: { userLoginId: userLoginId, id: courseId },
            },
        });

        if (!lesson) {
            throw new NotFoundException('Lesson not found');
        }

        const result = await this.prisma.word.createMany({
            data: words.map((word) => ({
                id: uuidv7(),
                word: word.word,
                meaning: word.meaning,
                pronunciation: word.pronunciation,
                partOfSpeech: word.partOfSpeech,
                audioUrl: word.audioUrl,
                lessonId: lessonId,
            })),
            skipDuplicates: true,
        });

        return { count: result.count };
    }

    async getWordById(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordId: string,
    ): Promise<Word> {
        const word = await this.prisma.word.findUnique({
            where: {
                id: wordId,
                lesson: {
                    id: lessonId,
                    course: {
                        userLoginId: userLoginId,
                        id: courseId,
                    },
                },
            },
        });

        if (!word) {
            throw new NotFoundException('Word not found');
        }

        return word;
    }

    async updateWord(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordId: string,
        payload: UpdateWordDto,
    ): Promise<Word> {
        // Verify word exists
        await this.getWordById(userLoginId, courseId, lessonId, wordId);

        return this.prisma.word.update({
            where: {
                id: wordId,
                lesson: {
                    id: lessonId,
                    course: {
                        userLoginId: userLoginId,
                        id: courseId,
                    },
                },
            },
            data: payload,
        });
    }

    async deleteWord(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordId: string,
    ): Promise<void> {
        // Verify word exists
        await this.getWordById(userLoginId, courseId, lessonId, wordId);

        await this.prisma.word.delete({
            where: {
                id: wordId,
                lesson: {
                    id: lessonId,
                    course: {
                        userLoginId: userLoginId,
                        id: courseId,
                    },
                },
            },
        });
    }

    async deleteWordsBulk(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordIds: string[],
    ): Promise<{ count: number }> {
        const result = await this.prisma.word.deleteMany({
            where: {
                id: { in: wordIds },
                lesson: {
                    id: lessonId,
                    course: { userLoginId: userLoginId, id: courseId },
                },
            },
        });

        return { count: result.count };
    }

    async moveWord(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordId: string,
        targetLessonId: string,
    ): Promise<Word> {
        // Verify word exists
        await this.getWordById(userLoginId, courseId, lessonId, wordId);

        // Verify target lesson exists
        const targetLesson = await this.prisma.lesson.findUnique({
            where: {
                id: targetLessonId,
                course: { userLoginId: userLoginId, id: courseId },
            },
        });

        if (!targetLesson) {
            throw new NotFoundException('Target lesson not found');
        }

        return this.prisma.word.update({
            where: {
                id: wordId,
                lesson: {
                    id: lessonId,
                    course: { userLoginId: userLoginId, id: courseId },
                },
            },
            data: { lessonId: targetLessonId },
        });
    }

    async moveWordsBulk(
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordIds: string[],
        targetLessonId: string,
    ): Promise<{ count: number }> {
        // Verify target lesson exists
        const targetLesson = await this.prisma.lesson.findUnique({
            where: {
                id: targetLessonId,
                course: { userLoginId: userLoginId, id: courseId },
            },
        });

        if (!targetLesson) {
            throw new NotFoundException('Target lesson not found');
        }

        const result = await this.prisma.word.updateMany({
            where: {
                id: {
                    in: wordIds,
                },
                lesson: {
                    id: lessonId,
                    course: { userLoginId: userLoginId, id: courseId },
                },
            },
            data: { lessonId: targetLessonId },
        });

        return { count: result.count };
    }
}
