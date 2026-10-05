import type { CourseHealth, MissingCounts } from './dto/admin-vocabulary.dto';

/** One row of the health query, as Postgres returns it (`::int` counts). */
export interface HealthRow {
    words: number;
    missing_ipa: number;
    missing_audio: number;
    missing_meaning: number;
    missing_example: number;
    missing_image: number;
    incomplete: number;
}

export interface CourseHealthRow extends HealthRow {
    course_id: string;
    name: string;
    user_login_id: string | null;
}

export const DEFAULT_WORST_COURSES = 10;

export function toMissing(row: HealthRow): MissingCounts {
    return {
        ipa: row.missing_ipa,
        audio: row.missing_audio,
        meaning: row.missing_meaning,
        example: row.missing_example,
        image: row.missing_image,
    };
}

export function toCourseHealth(row: CourseHealthRow): CourseHealth {
    return {
        courseId: row.course_id,
        name: row.name,
        userLoginId: row.user_login_id,
        words: row.words,
        missing: toMissing(row),
        incompleteWords: row.incomplete,
    };
}
