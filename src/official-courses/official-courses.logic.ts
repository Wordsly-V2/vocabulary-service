import type { Word } from '@prisma/client';

/**
 * The columns of a word that a learner's copy carries over: everything except
 * its identity, its lesson and its timestamps. Kept as a list so the spec can
 * check it against the Word model and a new column can't be forgotten.
 */
export const COPIED_WORD_FIELDS = [
    'word',
    'meaning',
    'pronunciation',
    'partOfSpeech',
    'audioUrl',
    'imageUrl',
    'example',
    'ukAudioUrl',
    'usAudioUrl',
    'ukIpa',
    'usIpa',
    'imageThumbnailUrl',
    'cefrLevel',
] as const satisfies readonly (keyof Word)[];

/** Word columns that are not copied (the copy gets its own). */
export const NOT_COPIED_WORD_FIELDS = [
    'id',
    'lessonId',
    'createdAt',
    'updatedAt',
    // When the official word was last synced, not the copy.
    'langeekSyncedAt',
] as const satisfies readonly (keyof Word)[];

export type CopiedWord = Pick<Word, (typeof COPIED_WORD_FIELDS)[number]>;

export function copiedWord(word: Word): CopiedWord {
    const copy = {} as Record<string, unknown>;
    for (const field of COPIED_WORD_FIELDS) copy[field] = word[field];
    return copy as CopiedWord;
}

/**
 * The newest copy of each official course among a learner's copies, keyed by
 * the official course id. `copies` must be newest first.
 */
export function newestCopies(
    copies: { id: string; sourceCourseId: string | null }[],
): Map<string, string> {
    const bySource = new Map<string, string>();
    for (const { id, sourceCourseId } of copies) {
        if (sourceCourseId && !bySource.has(sourceCourseId)) {
            bySource.set(sourceCourseId, id);
        }
    }
    return bySource;
}
