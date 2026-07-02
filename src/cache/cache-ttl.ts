export enum CacheKind {
    UserStats = 'userStats',
    CoursesList = 'coursesList',
    CourseDetail = 'courseDetail',
    CourseWords = 'courseWords',
    LessonsByCourse = 'lessonsByCourse',
    LessonDetail = 'lessonDetail',
    WordDetail = 'wordDetail',
    Search = 'search',
    Scope = 'scope',
    Dictionary = 'dictionary',
}

/** TTL in seconds per cache kind. Writes invalidate user cache; TTL is a safety net. */
export const CACHE_TTL_SECONDS: Record<CacheKind, number> = {
    [CacheKind.UserStats]: 2 * 60 * 60,
    [CacheKind.CoursesList]: 60 * 60,
    [CacheKind.CourseDetail]: 24 * 60 * 60,
    [CacheKind.CourseWords]: 4 * 60 * 60,
    [CacheKind.LessonsByCourse]: 4 * 60 * 60,
    [CacheKind.LessonDetail]: 24 * 60 * 60,
    [CacheKind.WordDetail]: 24 * 60 * 60,
    [CacheKind.Search]: 15 * 60,
    [CacheKind.Scope]: 60 * 60,
    // External dictionary content is effectively static; cache long to spare
    // the upstream scrapers (Cambridge/Langeek) and cut lookup latency.
    [CacheKind.Dictionary]: 7 * 24 * 60 * 60,
};
