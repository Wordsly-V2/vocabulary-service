/**
 * Parsing and merging for `Word.example`, which is a JSON-encoded array stored
 * in a plain `String` column.
 *
 * Two shapes exist in the wild and both must keep working:
 *  - `string[]` — the seed data in `words-data/bulk-*.json`
 *  - `{ text, translation?, audioUrl? }[]` — what the dictionary sync writes
 *
 * This service normalizes to the object shape on every write, so the drift dies
 * at the source. The frontend keeps its own reader (`lib/practice-utils.ts`
 * `parseExamples` / `serializeExamples`) because it must parse client-side and
 * has no import path into this service — the two are a paired implementation,
 * so change them together.
 */

export interface WordExample {
    text: string;
    translation?: string;
    audioUrl?: string;
}

/** Cap on stored examples per word — enough for variety, bounded for payload size. */
export const MAX_STORED_EXAMPLES = 6;

function cleanString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
}

/** Normalized key for de-duplicating examples that differ only in case/spacing. */
function exampleKey(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Parse the stored JSON array, accepting both the string and object shapes. */
export function parseWordExamples(
    raw: string | null | undefined,
): WordExample[] {
    if (!raw) {
        return [];
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) {
        return [];
    }

    const examples: WordExample[] = [];
    for (const entry of parsed) {
        if (typeof entry === 'string') {
            const text = cleanString(entry);
            if (text) {
                examples.push({ text });
            }
            continue;
        }
        if (entry && typeof entry === 'object') {
            const record = entry as Record<string, unknown>;
            const text = cleanString(record.text);
            if (!text) {
                continue;
            }
            const translation = cleanString(record.translation);
            const audioUrl = cleanString(record.audioUrl);
            examples.push({
                text,
                ...(translation ? { translation } : {}),
                ...(audioUrl ? { audioUrl } : {}),
            });
        }
    }
    return examples;
}

/** Serialize back to the stored JSON array, dropping empty fields. */
export function serializeWordExamples(examples: WordExample[]): string {
    return JSON.stringify(
        examples.map((example) => ({
            text: example.text,
            ...(example.translation ? { translation: example.translation } : {}),
            ...(example.audioUrl ? { audioUrl: example.audioUrl } : {}),
        })),
    );
}

/**
 * Merge freshly-scraped examples into what is already stored.
 *
 * Existing examples come first and win on de-duplication, but an incoming
 * duplicate may fill in a `translation` or `audioUrl` the stored one lacks —
 * that is how a plain seed string gets upgraded without being replaced.
 */
export function mergeWordExamples(
    existing: WordExample[],
    incoming: WordExample[],
    limit = MAX_STORED_EXAMPLES,
): WordExample[] {
    const byKey = new Map<string, WordExample>();

    for (const example of [...existing, ...incoming]) {
        const key = exampleKey(example.text);
        if (!key) {
            continue;
        }
        const current = byKey.get(key);
        if (!current) {
            byKey.set(key, { ...example });
            continue;
        }
        byKey.set(key, {
            ...current,
            translation: current.translation ?? example.translation,
            audioUrl: current.audioUrl ?? example.audioUrl,
        });
    }

    return [...byKey.values()].slice(0, limit);
}

/**
 * Whether an example can drive a cloze/gap-fill exercise: the target word has to
 * appear as a whole word so it can be blanked out. Mirrors the frontend's
 * `getClozePrompt` gate — an inflected example ("she ran" for "run") does not
 * qualify, which is why coverage is lower than raw example counts suggest.
 */
export function hasClozeableExample(
    word: string,
    examples: WordExample[],
): boolean {
    const target = word.trim();
    if (!target) {
        return false;
    }
    const pattern = new RegExp(
        `\\b${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i',
    );
    return examples.some((example) => pattern.test(example.text));
}
