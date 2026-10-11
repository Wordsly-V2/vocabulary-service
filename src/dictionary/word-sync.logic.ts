import {
    MAX_STORED_EXAMPLES,
    mergeWordExamples,
    parseWordExamples,
    serializeWordExamples,
    type WordExample,
} from '@/common/word-example.util';
import type { Word } from '@prisma/client';

/** What a Langeek sync can fill, as groups of Word columns an admin picks. */
export const SYNC_FIELDS = [
    'image',
    'meaning',
    'examples',
    'pronunciation',
    'level',
] as const;
export type SyncField = (typeof SYNC_FIELDS)[number];

/**
 * `fill_missing` writes a column only when it is blank; `overwrite` writes
 * whenever Langeek has a value. Neither ever blanks a column out.
 */
export const SYNC_MODES = ['fill_missing', 'overwrite'] as const;
/**
 * `merge` is the learner sync's behaviour, kept as it was: overwrite every
 * column Langeek has, but merge examples into the stored ones.
 */
export type SyncMode = (typeof SYNC_MODES)[number] | 'merge';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** Word columns each field group writes (examples are handled on their own). */
const FIELD_COLUMNS = {
    image: ['imageUrl', 'imageThumbnailUrl'],
    meaning: ['meaning'],
    examples: [],
    pronunciation: [
        'pronunciation',
        'audioUrl',
        'ukAudioUrl',
        'usAudioUrl',
        'ukIpa',
        'usIpa',
    ],
    level: ['cefrLevel', 'partOfSpeech'],
} as const satisfies Record<SyncField, readonly (keyof Word)[]>;

type SyncColumn = (typeof FIELD_COLUMNS)[SyncField][number];

/** The stored columns a sync compares against. */
export type SyncedWord = Pick<Word, SyncColumn | 'example'>;

/** What Langeek (and Cambridge, for UK/US pronunciation) returned for a word. */
export type FetchedWord = Partial<Record<SyncColumn, string | null>> & {
    examples?: WordExample[];
};

export interface WordUpdatePlan {
    data: Partial<Record<SyncColumn | 'example', string>>;
    /** Field groups with at least one column written. */
    changedFields: SyncField[];
}

const clean = (value: string | null | undefined): string | undefined =>
    value?.trim() || undefined;

/** A CEFR level as stored (`B2`), or undefined for anything else Langeek sends. */
export function normalizeCefrLevel(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const level = value.trim().toUpperCase();
    return (CEFR_LEVELS as readonly string[]).includes(level)
        ? level
        : undefined;
}

/**
 * Which columns of `current` to write from `fetched`, for the chosen field
 * groups and mode. Pure, so both the learner and the admin sync go through it.
 */
export function planWordUpdate(
    current: SyncedWord,
    fetched: FetchedWord,
    fields: readonly SyncField[],
    mode: SyncMode,
): WordUpdatePlan {
    const data: WordUpdatePlan['data'] = {};
    const changed = new Set<SyncField>();

    for (const field of fields) {
        for (const column of FIELD_COLUMNS[field] as readonly SyncColumn[]) {
            const value = clean(fetched[column]);
            if (!value) continue;
            const stored = clean(current[column]);
            if (mode === 'fill_missing' && stored) continue;
            if (value === stored) continue;
            data[column] = value;
            changed.add(field);
        }
    }

    if (fields.includes('examples')) {
        const example = planExamples(
            current.example,
            fetched.examples ?? [],
            mode,
        );
        if (example !== undefined) {
            data.example = example;
            changed.add('examples');
        }
    }

    return {
        data,
        changedFields: SYNC_FIELDS.filter((field) => changed.has(field)),
    };
}

/** The serialized examples to store, or undefined to leave the column alone. */
function planExamples(
    storedRaw: string | null,
    incoming: WordExample[],
    mode: SyncMode,
): string | undefined {
    if (incoming.length === 0) return undefined;
    const stored = parseWordExamples(storedRaw);
    if (mode === 'fill_missing' && stored.length > 0) return undefined;

    const next =
        mode === 'merge'
            ? mergeWordExamples(stored, incoming)
            : mergeWordExamples([], incoming).slice(0, MAX_STORED_EXAMPLES);
    const serialized = serializeWordExamples(next);
    return stored.length > 0 && serialized === serializeWordExamples(stored)
        ? undefined
        : serialized;
}
