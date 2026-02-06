import { Test, TestingModule } from '@nestjs/testing';
import { WordProgressService } from './word-progress.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AnswerQuality } from './dto/word-progress.dto';

describe('WordProgressService - SM-2 Algorithm', () => {
    let service: WordProgressService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WordProgressService,
                {
                    provide: PrismaService,
                    useValue: {
                        word: {
                            findFirst: jest.fn(),
                            findMany: jest.fn(),
                            count: jest.fn(),
                        },
                        wordProgress: {
                            findUnique: jest.fn(),
                            findMany: jest.fn(),
                            create: jest.fn(),
                            update: jest.fn(),
                            deleteMany: jest.fn(),
                        },
                        $transaction: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<WordProgressService>(WordProgressService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('SM-2 Algorithm Calculations', () => {
        it('should calculate correct interval for first review with perfect answer', async () => {
            const mockWord = {
                id: 'word-1',
                word: 'test',
                meaning: 'test meaning',
                pronunciation: null,
                partOfSpeech: null,
                audioUrl: null,
                lessonId: 'lesson-1',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockProgress = {
                id: 'progress-1',
                wordId: 'word-1',
                userLoginId: 'user-1',
                easeFactor: 2.6,
                interval: 1,
                repetitions: 1,
                lastReviewedAt: new Date(),
                nextReviewAt: new Date(Date.now() + 86400000),
                totalReviews: 1,
                correctReviews: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            jest.spyOn(prisma.word, 'findFirst').mockResolvedValue(mockWord);
            jest.spyOn(prisma.wordProgress, 'findUnique').mockResolvedValue(null);
            jest.spyOn(prisma.wordProgress, 'create').mockResolvedValue(mockProgress);

            const result = await service.recordAnswer('user-1', {
                wordId: 'word-1',
                quality: AnswerQuality.PERFECT,
            });

            expect(result.interval).toBe(1);
            expect(result.repetitions).toBe(1);
            expect(result.easeFactor).toBeGreaterThan(2.5);
        });

        it('should reset progress for incorrect answer (quality < 3)', async () => {
            const mockWord = {
                id: 'word-1',
                word: 'test',
                meaning: 'test meaning',
                pronunciation: null,
                partOfSpeech: null,
                audioUrl: null,
                lessonId: 'lesson-1',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const existingProgress = {
                id: 'progress-1',
                wordId: 'word-1',
                userLoginId: 'user-1',
                easeFactor: 2.5,
                interval: 6,
                repetitions: 2,
                lastReviewedAt: new Date(),
                nextReviewAt: new Date(),
                totalReviews: 2,
                correctReviews: 2,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedProgress = {
                ...existingProgress,
                interval: 1,
                repetitions: 0,
                totalReviews: 3,
                correctReviews: 2,
            };

            jest.spyOn(prisma.word, 'findFirst').mockResolvedValue(mockWord);
            jest.spyOn(prisma.wordProgress, 'findUnique').mockResolvedValue(existingProgress);
            jest.spyOn(prisma.wordProgress, 'update').mockResolvedValue(updatedProgress);

            const result = await service.recordAnswer('user-1', {
                wordId: 'word-1',
                quality: AnswerQuality.INCORRECT,
            });

            expect(result.interval).toBe(1);
            expect(result.repetitions).toBe(0);
        });

        it('should calculate 6-day interval for second correct review', async () => {
            const mockWord = {
                id: 'word-1',
                word: 'test',
                meaning: 'test meaning',
                pronunciation: null,
                partOfSpeech: null,
                audioUrl: null,
                lessonId: 'lesson-1',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const existingProgress = {
                id: 'progress-1',
                wordId: 'word-1',
                userLoginId: 'user-1',
                easeFactor: 2.6,
                interval: 1,
                repetitions: 1,
                lastReviewedAt: new Date(),
                nextReviewAt: new Date(),
                totalReviews: 1,
                correctReviews: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedProgress = {
                ...existingProgress,
                interval: 6,
                repetitions: 2,
                totalReviews: 2,
                correctReviews: 2,
            };

            jest.spyOn(prisma.word, 'findFirst').mockResolvedValue(mockWord);
            jest.spyOn(prisma.wordProgress, 'findUnique').mockResolvedValue(existingProgress);
            jest.spyOn(prisma.wordProgress, 'update').mockResolvedValue(updatedProgress);

            const result = await service.recordAnswer('user-1', {
                wordId: 'word-1',
                quality: AnswerQuality.PERFECT,
            });

            expect(result.interval).toBe(6);
            expect(result.repetitions).toBe(2);
        });
    });

    describe('Progress Statistics', () => {
        it('should calculate correct statistics', async () => {
            const mockProgresses = [
                {
                    id: 'p1',
                    wordId: 'w1',
                    userLoginId: 'user-1',
                    easeFactor: 2.5,
                    interval: 1,
                    repetitions: 1,
                    lastReviewedAt: new Date(),
                    nextReviewAt: new Date(),
                    totalReviews: 5,
                    correctReviews: 4,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: 'p2',
                    wordId: 'w2',
                    userLoginId: 'user-1',
                    easeFactor: 2.7,
                    interval: 16,
                    repetitions: 3,
                    lastReviewedAt: new Date(),
                    nextReviewAt: new Date(Date.now() + 86400000),
                    totalReviews: 3,
                    correctReviews: 3,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            jest.spyOn(prisma.word, 'count').mockResolvedValue(10);
            jest.spyOn(prisma.wordProgress, 'findMany').mockResolvedValue(mockProgresses);

            const stats = await service.getProgressStats('user-1');

            expect(stats.totalWords).toBe(10);
            expect(stats.newWords).toBe(8); // 10 total - 2 with progress
            expect(stats.learningWords).toBe(1); // repetitions < 3
            expect(stats.reviewWords).toBe(1); // repetitions >= 3
            expect(stats.overallSuccessRate).toBe(87.5); // (4+3)/(5+3) * 100
        });
    });

    describe('Due Words', () => {
        it('should return words due for review and new words', async () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 86400000);

            const mockWords = [
                {
                    id: 'word-1',
                    word: 'test1',
                    meaning: 'meaning1',
                    pronunciation: null,
                    partOfSpeech: null,
                    audioUrl: null,
                    lessonId: 'lesson-1',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lesson: { id: 'lesson-1', courseId: 'course-1' },
                    wordProgress: [
                        {
                            id: 'progress-1',
                            wordId: 'word-1',
                            userLoginId: 'user-1',
                            easeFactor: 2.5,
                            interval: 1,
                            repetitions: 1,
                            lastReviewedAt: yesterday,
                            nextReviewAt: yesterday,
                            totalReviews: 1,
                            correctReviews: 1,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                    ],
                },
                {
                    id: 'word-2',
                    word: 'test2',
                    meaning: 'meaning2',
                    pronunciation: null,
                    partOfSpeech: null,
                    audioUrl: null,
                    lessonId: 'lesson-1',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lesson: { id: 'lesson-1', courseId: 'course-1' },
                    wordProgress: [],
                },
            ];

            jest.spyOn(prisma.word, 'findMany').mockResolvedValue(mockWords as any);

            const dueWords = await service.getDueWords('user-1', { limit: 10 });

            expect(dueWords).toHaveLength(2);
            expect(dueWords[0].isNew).toBe(false); // Due word comes first
            expect(dueWords[1].isNew).toBe(true); // New word comes second
        });
    });
});
