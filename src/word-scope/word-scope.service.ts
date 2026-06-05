import { cacheKeys } from '@/cache/cache-keys';
import { CacheService } from '@/cache/cache.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import type { WordScopeGroupDto } from './dto/word-scope.dto';

@Injectable()
export class WordScopeService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    async getScopedWordIds(
        userLoginId: string,
        courseId?: string,
        lessonId?: string,
    ): Promise<string[]> {
        return this.cacheService.getOrSet(
            userLoginId,
            [cacheKeys.scopedWordIds(userLoginId, courseId, lessonId)],
            async () => {
                const words = await this.prisma.word.findMany({
                    where: {
                        lesson: {
                            course: {
                                userLoginId,
                                ...(courseId && { id: courseId }),
                            },
                            ...(lessonId && { id: lessonId }),
                        },
                    },
                    select: { id: true },
                    orderBy: [{ lesson: { orderIndex: 'asc' } }, { word: 'asc' }],
                });
                return words.map((w) => w.id);
            },
        );
    }

    async hasWordAccess(
        userLoginId: string,
        wordId: string,
    ): Promise<boolean> {
        return this.cacheService.getOrSet(
            userLoginId,
            [cacheKeys.hasWordAccess(userLoginId, wordId)],
            async () => {
                const word = await this.prisma.word.findFirst({
                    where: {
                        id: wordId,
                        lesson: { course: { userLoginId } },
                    },
                    select: { id: true },
                });
                return word != null;
            },
        );
    }

    async filterOwnedWordIds(
        userLoginId: string,
        wordIds: string[],
    ): Promise<string[]> {
        if (wordIds.length === 0) {
            return [];
        }

        return this.cacheService.getOrSet(
            userLoginId,
            [cacheKeys.filterOwnedWordIds(userLoginId, wordIds)],
            async () => {
                const words = await this.prisma.word.findMany({
                    where: {
                        id: { in: wordIds },
                        lesson: { course: { userLoginId } },
                    },
                    select: { id: true },
                });
                return words.map((w) => w.id);
            },
        );
    }

    async groupByLessonIds(
        userLoginId: string,
        lessonIds: string[],
    ): Promise<Record<string, WordScopeGroupDto>> {
        return this.cacheService.getOrSet(
            userLoginId,
            [cacheKeys.groupByLessonIds(userLoginId, lessonIds)],
            async () => {
                const result = Object.fromEntries(
                    lessonIds.map((id) => [
                        id,
                        { wordIds: [], totalWords: 0 },
                    ]),
                ) as Record<string, WordScopeGroupDto>;

                if (lessonIds.length === 0) {
                    return result;
                }

                const words = await this.prisma.word.findMany({
                    where: {
                        lessonId: { in: lessonIds },
                        lesson: { course: { userLoginId } },
                    },
                    select: { id: true, lessonId: true },
                    orderBy: { word: 'asc' },
                });

                for (const word of words) {
                    result[word.lessonId].wordIds.push(word.id);
                    result[word.lessonId].totalWords++;
                }

                return result;
            },
        );
    }

    async groupByCourseIds(
        userLoginId: string,
        courseIds: string[],
    ): Promise<Record<string, WordScopeGroupDto>> {
        return this.cacheService.getOrSet(
            userLoginId,
            [cacheKeys.groupByCourseIds(userLoginId, courseIds)],
            async () => {
                const result = Object.fromEntries(
                    courseIds.map((id) => [
                        id,
                        { wordIds: [], totalWords: 0 },
                    ]),
                ) as Record<string, WordScopeGroupDto>;

                if (courseIds.length === 0) {
                    return result;
                }

                const words = await this.prisma.word.findMany({
                    where: {
                        lesson: {
                            courseId: { in: courseIds },
                            course: { userLoginId },
                        },
                    },
                    select: {
                        id: true,
                        lesson: { select: { courseId: true } },
                    },
                    orderBy: [{ lesson: { orderIndex: 'asc' } }, { word: 'asc' }],
                });

                for (const word of words) {
                    const courseId = word.lesson.courseId;
                    result[courseId].wordIds.push(word.id);
                    result[courseId].totalWords++;
                }

                return result;
            },
        );
    }
}
