const encode = (value: string): string =>
    encodeURIComponent(value).replace(/%/g, '_');

export const cacheKeys = {
    userStats: (userLoginId: string) => `stats`,

    coursesList: (
        userLoginId: string,
        page: number,
        limit: number,
        orderByField: string,
        orderByDirection: string,
        searchQuery: string,
    ) =>
        `courses:p${page}:l${limit}:${orderByField}:${orderByDirection}:${encode(searchQuery)}`,

    courseDetail: (userLoginId: string, courseId: string) =>
        `course:${courseId}`,

    courseWords: (userLoginId: string, courseId: string, wordIds: string[]) =>
        `course:${courseId}:words:${[...wordIds].sort().join(',')}`,

    lessonsByCourse: (userLoginId: string, courseId: string) =>
        `course:${courseId}:lessons`,

    lessonDetail: (userLoginId: string, courseId: string, lessonId: string) =>
        `course:${courseId}:lesson:${lessonId}`,

    wordDetail: (
        userLoginId: string,
        courseId: string,
        lessonId: string,
        wordId: string,
    ) => `course:${courseId}:lesson:${lessonId}:word:${wordId}`,

    searchUserWords: (userLoginId: string, searchTerm: string, limit: number) =>
        `search:${encode(searchTerm)}:l${limit}`,

    scopedWordIds: (
        userLoginId: string,
        courseId?: string,
        lessonId?: string,
    ) =>
        `scope:ids:c${courseId ?? 'all'}:l${lessonId ?? 'all'}`,

    hasWordAccess: (userLoginId: string, wordId: string) =>
        `scope:access:${wordId}`,

    filterOwnedWordIds: (userLoginId: string, wordIds: string[]) =>
        `scope:owned:${[...wordIds].sort().join(',')}`,

    groupByLessonIds: (userLoginId: string, lessonIds: string[]) =>
        `scope:by-lesson:${[...lessonIds].sort().join(',')}`,

    groupByCourseIds: (userLoginId: string, courseIds: string[]) =>
        `scope:by-course:${[...courseIds].sort().join(',')}`,
};

export const userCachePattern = (userLoginId: string): string =>
    `vocab:u:${userLoginId}:*`;
