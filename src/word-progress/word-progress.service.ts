import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WordProgress } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import {
    AnswerQuality,
    DueWordDto,
    GetDueWordsPaginatedQueryDto,
    GetDueWordsQueryDto,
    PaginatedDueWordsResponseDto,
    RecordAnswerDto,
    WordProgressResponseDto,
    WordProgressStatsDto,
} from './dto/word-progress.dto';

/**
 * Word Progress Service
 * Implements the SuperMemo SM-2 spaced repetition algorithm
 *
 * Algorithm Details:
 * - EF (Ease Factor): Represents how easy a word is to remember (default: 2.5)
 * - Interval: Days until the next review
 * - Repetitions: Number of consecutive correct answers
 *
 * The algorithm adjusts the interval based on the quality of the answer:
 * - Quality 0-2: Reset progress, review again tomorrow
 * - Quality 3-5: Increase interval based on ease factor
 */
@Injectable()
export class WordProgressService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Calculate the next review interval using the SM-2 algorithm
     *
     * @param quality - Answer quality (0-5)
     * @param easeFactor - Current ease factor
     * @param interval - Current interval in days
     * @param repetitions - Number of consecutive correct answers
     * @returns Updated values for ease factor, interval, and repetitions
     */
    private calculateNextReview(
        quality: AnswerQuality,
        easeFactor: number,
        interval: number,
        repetitions: number,
    ): { easeFactor: number; interval: number; repetitions: number } {
        // Calculate new ease factor
        // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        let newEaseFactor =
            easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

        // Ensure ease factor doesn't go below 1.3
        if (newEaseFactor < 1.3) {
            newEaseFactor = 1.3;
        }

        let newInterval: number;
        let newRepetitions: number;

        // If quality is less than 3, reset repetitions and set interval to 1 day
        if (quality < AnswerQuality.CORRECT_WITH_DIFFICULTY) {
            newRepetitions = 0;
            newInterval = 1;
        } else {
            newRepetitions = repetitions + 1;

            // Calculate interval based on repetitions
            if (newRepetitions === 1) {
                newInterval = 1;
            } else if (newRepetitions === 2) {
                newInterval = 6;
            } else {
                // For subsequent reviews: I(n) = I(n-1) * EF
                newInterval = Math.round(interval * newEaseFactor);
            }
        }

        return {
            easeFactor: newEaseFactor,
            interval: newInterval,
            repetitions: newRepetitions,
        };
    }

    /**
     * Record an answer for a word and update the spaced repetition schedule
     */
    async recordAnswer(
        userLoginId: string,
        recordAnswerDto: RecordAnswerDto,
    ): Promise<WordProgressResponseDto> {
        const { wordId, quality } = recordAnswerDto;

        // Verify word exists and user has access
        const word = await this.prisma.word.findFirst({
            where: {
                id: wordId,
                lesson: {
                    course: {
                        userLoginId: userLoginId,
                    },
                },
            },
        });

        if (!word) {
            throw new NotFoundException('Word not found or access denied');
        }

        // Get or create word progress
        let wordProgress = await this.prisma.wordProgress.findUnique({
            where: {
                wordId_userLoginId: {
                    wordId,
                    userLoginId,
                },
            },
        });

        const now = new Date();
        const isCorrect = quality >= AnswerQuality.CORRECT_WITH_DIFFICULTY;

        if (!wordProgress) {
            // Create new word progress
            const { easeFactor, interval, repetitions } =
                this.calculateNextReview(
                    quality,
                    2.5, // Default ease factor
                    0, // Default interval
                    0, // Default repetitions
                );

            const nextReviewAt = new Date(now);
            nextReviewAt.setDate(nextReviewAt.getDate() + interval);

            wordProgress = await this.prisma.wordProgress.create({
                data: {
                    id: uuidv7(),
                    wordId,
                    userLoginId,
                    easeFactor,
                    interval,
                    repetitions,
                    lastReviewedAt: now,
                    nextReviewAt,
                    totalReviews: 1,
                    correctReviews: isCorrect ? 1 : 0,
                },
            });
        } else {
            // Update existing word progress
            const { easeFactor, interval, repetitions } =
                this.calculateNextReview(
                    quality,
                    wordProgress.easeFactor,
                    wordProgress.interval,
                    wordProgress.repetitions,
                );

            const nextReviewAt = new Date(now);
            nextReviewAt.setDate(nextReviewAt.getDate() + interval);

            wordProgress = await this.prisma.wordProgress.update({
                where: { id: wordProgress.id },
                data: {
                    easeFactor,
                    interval,
                    repetitions,
                    lastReviewedAt: now,
                    nextReviewAt,
                    totalReviews: { increment: 1 },
                    correctReviews: isCorrect ? { increment: 1 } : undefined,
                },
            });
        }

        return this.mapToProgressResponse(wordProgress);
    }

    /**
     * Record multiple answers in a single transaction
     */
    async recordAnswers(
        userLoginId: string,
        answers: RecordAnswerDto[],
    ): Promise<WordProgressResponseDto[]> {
        const results: WordProgressResponseDto[] = [];

        for (const answer of answers) {
            const result = await this.recordAnswer(userLoginId, answer);
            results.push(result);
        }

        return results;
    }

    /**
     * Get words that are due for review based on spaced repetition algorithm
     */
    async getDueWords(
        userLoginId: string,
        query: GetDueWordsQueryDto,
    ): Promise<DueWordDto[]> {
        const { courseId, lessonId, limit = 20, includeNew = true } = query;
        const now = new Date();

        // Build where clause for words
        const wordWhere: Prisma.WordWhereInput = {
            lesson: {
                course: {
                    userLoginId,
                    ...(courseId && { id: courseId }),
                },
                ...(lessonId && { id: lessonId }),
            },
        };

        // Get words with their progress
        const words = await this.prisma.word.findMany({
            where: wordWhere,
            include: {
                wordProgress: {
                    where: {
                        userLoginId,
                    },
                },
                lesson: {
                    select: {
                        id: true,
                        courseId: true,
                    },
                },
            },
            orderBy: {
                word: 'asc',
            },
        });

        // Filter and sort words based on due date
        const dueWords: DueWordDto[] = [];

        for (const word of words) {
            const progress = word.wordProgress[0];

            if (!progress) {
                // New word - not yet reviewed
                if (includeNew && dueWords.length < limit) {
                    // Create a temporary progress object for new words
                    const newProgress: WordProgressResponseDto = {
                        id: '',
                        wordId: word.id,
                        userLoginId,
                        easeFactor: 2.5,
                        interval: 0,
                        repetitions: 0,
                        lastReviewedAt: undefined,
                        nextReviewAt: now,
                        totalReviews: 0,
                        correctReviews: 0,
                        successRate: 0,
                    };

                    dueWords.push({
                        ...newProgress,
                        word: {
                            id: word.id,
                            word: word.word,
                            meaning: word.meaning,
                            pronunciation: word.pronunciation ?? undefined,
                            partOfSpeech: word.partOfSpeech ?? undefined,
                            audioUrl: word.audioUrl ?? undefined,
                            lessonId: word.lessonId,
                        },
                        isNew: true,
                    });
                }
            } else if (
                progress.nextReviewAt <= now &&
                dueWords.length < limit
            ) {
                // Due for review
                const progressResponse = this.mapToProgressResponse(progress);
                dueWords.push({
                    ...progressResponse,
                    word: {
                        id: word.id,
                        word: word.word,
                        meaning: word.meaning,
                        pronunciation: word.pronunciation ?? undefined,
                        partOfSpeech: word.partOfSpeech ?? undefined,
                        audioUrl: word.audioUrl ?? undefined,
                        lessonId: word.lessonId,
                    },
                    isNew: false,
                });
            }
        }

        // Sort: prioritize overdue words, then new words
        dueWords.sort((a, b) => {
            // Both are old words - sort by how overdue they are
            if (!a.isNew && !b.isNew) {
                return a.nextReviewAt.getTime() - b.nextReviewAt.getTime();
            }
            // New words come after due words
            if (a.isNew && !b.isNew) return 1;
            if (!a.isNew && b.isNew) return -1;
            return 0;
        });

        return dueWords.slice(0, limit);
    }

    /**
     * Get due words for review with pagination
     */
    async getDueWordsPaginated(
        userLoginId: string,
        query: GetDueWordsPaginatedQueryDto,
    ): Promise<PaginatedDueWordsResponseDto> {
        const {
            courseId,
            lessonId,
            page = 1,
            limit = 20,
            includeNew = true,
        } = query;
        const now = new Date();

        // Build where clause for words
        const wordWhere: Prisma.WordWhereInput = {
            lesson: {
                course: {
                    userLoginId,
                    ...(courseId && { id: courseId }),
                },
                ...(lessonId && { id: lessonId }),
            },
        };

        // Get words with their progress
        const words = await this.prisma.word.findMany({
            where: wordWhere,
            include: {
                wordProgress: {
                    where: {
                        userLoginId,
                    },
                },
                lesson: {
                    select: {
                        id: true,
                        courseId: true,
                    },
                },
            },
            orderBy: {
                word: 'asc',
            },
        });

        // Filter words based on due date
        const allDueWords: DueWordDto[] = [];

        for (const word of words) {
            const progress = word.wordProgress[0];

            if (!progress) {
                // New word - not yet reviewed
                if (includeNew) {
                    // Create a temporary progress object for new words
                    const newProgress: WordProgressResponseDto = {
                        id: '',
                        wordId: word.id,
                        userLoginId,
                        easeFactor: 2.5,
                        interval: 0,
                        repetitions: 0,
                        lastReviewedAt: undefined,
                        nextReviewAt: now,
                        totalReviews: 0,
                        correctReviews: 0,
                        successRate: 0,
                    };

                    allDueWords.push({
                        ...newProgress,
                        word: {
                            id: word.id,
                            word: word.word,
                            meaning: word.meaning,
                            pronunciation: word.pronunciation ?? undefined,
                            partOfSpeech: word.partOfSpeech ?? undefined,
                            audioUrl: word.audioUrl ?? undefined,
                            lessonId: word.lessonId,
                        },
                        isNew: true,
                    });
                }
            } else if (progress.nextReviewAt <= now) {
                // Due for review
                const progressResponse = this.mapToProgressResponse(progress);
                allDueWords.push({
                    ...progressResponse,
                    word: {
                        id: word.id,
                        word: word.word,
                        meaning: word.meaning,
                        pronunciation: word.pronunciation ?? undefined,
                        partOfSpeech: word.partOfSpeech ?? undefined,
                        audioUrl: word.audioUrl ?? undefined,
                        lessonId: word.lessonId,
                    },
                    isNew: false,
                });
            }
        }

        // Sort: prioritize overdue words, then new words
        allDueWords.sort((a, b) => {
            // Both are old words - sort by how overdue they are
            if (!a.isNew && !b.isNew) {
                return a.nextReviewAt.getTime() - b.nextReviewAt.getTime();
            }
            // New words come after due words
            if (a.isNew && !b.isNew) return 1;
            if (!a.isNew && b.isNew) return -1;
            return 0;
        });

        // Calculate pagination
        const totalDueWords = allDueWords.length;
        const totalPages = Math.ceil(totalDueWords / limit);
        const skip = (page - 1) * limit;
        const items = allDueWords.slice(skip, skip + limit);

        return {
            items,
            totalItems: totalDueWords,
            currentPage: page,
            limit,
            totalPages,
            currentPageItems: items.length,
        };
    }

    /**
     * Compute word-progress stats from total word count and progress records.
     * Reusable for any scope (global, course, lesson).
     */
    private computeStatsFromProgresses(
        totalWords: number,
        wordProgresses: WordProgress[],
        now: Date,
    ): WordProgressStatsDto {
        const newWords = totalWords - wordProgresses.length;
        let learningWords = 0;
        let reviewWords = 0;
        let dueToday = 0;
        let totalReviews = 0;
        let totalCorrect = 0;

        for (const progress of wordProgresses) {
            totalReviews += progress.totalReviews;
            totalCorrect += progress.correctReviews;
            if (progress.repetitions < 3) {
                learningWords++;
            } else {
                reviewWords++;
            }
            if (progress.nextReviewAt <= now) {
                dueToday++;
            }
        }

        const overallSuccessRate =
            totalReviews > 0
                ? Math.round((totalCorrect / totalReviews) * 100 * 10) / 10
                : 0;

        return {
            totalWords,
            newWords,
            learningWords,
            reviewWords,
            dueToday,
            overallSuccessRate,
        };
    }

    /**
     * Get progress statistics for a user (optional scope by course and/or lesson).
     */
    async getProgressStats(
        userLoginId: string,
        courseId?: string,
        lessonId?: string,
    ): Promise<WordProgressStatsDto> {
        const now = new Date();
        const wordWhere: Prisma.WordWhereInput = {
            lesson: {
                course: {
                    userLoginId,
                    ...(courseId && { id: courseId }),
                },
                ...(lessonId && { id: lessonId }),
            },
        };

        const [totalWords, wordProgresses] = await Promise.all([
            this.prisma.word.count({ where: wordWhere }),
            this.prisma.wordProgress.findMany({
                where: { userLoginId, word: wordWhere },
            }),
        ]);

        return this.computeStatsFromProgresses(totalWords, wordProgresses, now);
    }

    /**
     * Get progress stats keyed by lesson ID. Reusable for enriching lesson lists.
     */
    async getProgressStatsMapByLessonIds(
        userLoginId: string,
        lessonIds: string[],
    ): Promise<Map<string, WordProgressStatsDto>> {
        if (lessonIds.length === 0) return new Map();
        const now = new Date();

        const [wordCountByLesson, progressList] = await Promise.all([
            this.prisma.word.groupBy({
                by: ['lessonId'],
                where: { lessonId: { in: lessonIds } },
                _count: { id: true },
            }),
            this.prisma.wordProgress.findMany({
                where: {
                    userLoginId,
                    word: { lessonId: { in: lessonIds } },
                },
                include: {
                    word: { select: { lessonId: true } },
                },
            }),
        ]);

        const totalWordsByLesson = new Map(
            wordCountByLesson.map((g) => [g.lessonId, g._count.id]),
        );
        const progressByLesson = new Map<string, WordProgress[]>();
        for (const p of progressList) {
            const lessonId = p.word.lessonId;
            if (!progressByLesson.has(lessonId)) {
                progressByLesson.set(lessonId, []);
            }
            progressByLesson.get(lessonId)!.push(p as WordProgress);
        }

        const result = new Map<string, WordProgressStatsDto>();
        for (const lessonId of lessonIds) {
            const totalWords = totalWordsByLesson.get(lessonId) ?? 0;
            const progresses = progressByLesson.get(lessonId) ?? [];
            result.set(
                lessonId,
                this.computeStatsFromProgresses(totalWords, progresses, now),
            );
        }
        return result;
    }

    /**
     * Get progress stats keyed by course ID. Reusable for enriching course lists.
     */
    async getProgressStatsMapByCourseIds(
        userLoginId: string,
        courseIds: string[],
    ): Promise<Map<string, WordProgressStatsDto>> {
        if (courseIds.length === 0) return new Map();
        const now = new Date();

        const [lessons, wordCountByLesson, progressList] = await Promise.all([
            this.prisma.lesson.findMany({
                where: { courseId: { in: courseIds } },
                select: { id: true, courseId: true },
            }),
            this.prisma.word.groupBy({
                by: ['lessonId'],
                where: { lesson: { courseId: { in: courseIds } } },
                _count: { id: true },
            }),
            this.prisma.wordProgress.findMany({
                where: {
                    userLoginId,
                    word: { lesson: { courseId: { in: courseIds } } },
                },
                include: {
                    word: {
                        select: { lesson: { select: { courseId: true } } },
                    },
                },
            }),
        ]);

        const lessonToCourse = new Map(lessons.map((l) => [l.id, l.courseId]));
        const wordCountByCourse = new Map<string, number>();
        for (const g of wordCountByLesson) {
            const courseId = lessonToCourse.get(g.lessonId);
            if (courseId != null) {
                wordCountByCourse.set(
                    courseId,
                    (wordCountByCourse.get(courseId) ?? 0) + g._count.id,
                );
            }
        }

        const progressByCourse = new Map<string, WordProgress[]>();
        for (const p of progressList) {
            const courseId = p.word.lesson.courseId;
            if (!progressByCourse.has(courseId)) {
                progressByCourse.set(courseId, []);
            }
            progressByCourse.get(courseId)!.push(p as WordProgress);
        }

        const result = new Map<string, WordProgressStatsDto>();
        for (const courseId of courseIds) {
            const totalWords = wordCountByCourse.get(courseId) ?? 0;
            const progresses = progressByCourse.get(courseId) ?? [];
            result.set(
                courseId,
                this.computeStatsFromProgresses(totalWords, progresses, now),
            );
        }
        return result;
    }

    /**
     * Get progress for a specific word
     */
    async getWordProgress(
        userLoginId: string,
        wordId: string,
    ): Promise<WordProgressResponseDto | null> {
        const progress = await this.prisma.wordProgress.findUnique({
            where: {
                wordId_userLoginId: {
                    wordId,
                    userLoginId,
                },
            },
        });

        return progress ? this.mapToProgressResponse(progress) : null;
    }

    /**
     * Get progress for multiple words by word IDs.
     * Returns a map of wordId -> WordProgressResponseDto (null if no progress).
     */
    async getProgressMapByWordIds(
        userLoginId: string,
        wordIds: string[],
    ): Promise<Map<string, WordProgressResponseDto | null>> {
        if (wordIds.length === 0) {
            return new Map();
        }
        const progressList = await this.prisma.wordProgress.findMany({
            where: {
                userLoginId,
                wordId: { in: wordIds },
            },
        });
        const result = new Map<string, WordProgressResponseDto | null>();
        for (const wordId of wordIds) {
            const progress = progressList.find((p) => p.wordId === wordId);
            result.set(
                wordId,
                progress ? this.mapToProgressResponse(progress) : null,
            );
        }
        return result;
    }

    /**
     * Reset progress for a specific word
     */
    async resetProgress(userLoginId: string, wordId: string): Promise<void> {
        // Verify word exists and user has access
        const word = await this.prisma.word.findFirst({
            where: {
                id: wordId,
                lesson: {
                    course: {
                        userLoginId,
                    },
                },
            },
        });

        if (!word) {
            throw new NotFoundException('Word not found or access denied');
        }

        await this.prisma.wordProgress.deleteMany({
            where: {
                wordId,
                userLoginId,
            },
        });
    }

    /**
     * Map WordProgress entity to response DTO
     */
    private mapToProgressResponse(
        progress: WordProgress,
    ): WordProgressResponseDto {
        const successRate =
            progress.totalReviews > 0
                ? Math.round(
                      (progress.correctReviews / progress.totalReviews) *
                          100 *
                          10,
                  ) / 10
                : 0;

        return {
            id: progress.id,
            wordId: progress.wordId,
            userLoginId: progress.userLoginId,
            easeFactor: progress.easeFactor,
            interval: progress.interval,
            repetitions: progress.repetitions,
            lastReviewedAt: progress.lastReviewedAt ?? undefined,
            nextReviewAt: progress.nextReviewAt,
            totalReviews: progress.totalReviews,
            correctReviews: progress.correctReviews,
            successRate,
        };
    }
}
