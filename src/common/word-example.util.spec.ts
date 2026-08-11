import {
    hasClozeableExample,
    mergeWordExamples,
    parseWordExamples,
    serializeWordExamples,
} from './word-example.util';

describe('parseWordExamples', () => {
    it('reads the seed data shape (array of plain strings)', () => {
        expect(parseWordExamples('["She felt anxious.", "  "]')).toEqual([
            { text: 'She felt anxious.' },
        ]);
    });

    it('reads the sync pipeline shape (array of objects)', () => {
        const raw = JSON.stringify([
            { text: 'She felt anxious.', translation: 'Cô ấy lo lắng.' },
            { text: 'No text here', audioUrl: 'https://cdn/a.mp3' },
        ]);
        expect(parseWordExamples(raw)).toEqual([
            { text: 'She felt anxious.', translation: 'Cô ấy lo lắng.' },
            { text: 'No text here', audioUrl: 'https://cdn/a.mp3' },
        ]);
    });

    it('returns empty for null, malformed JSON, and non-arrays', () => {
        expect(parseWordExamples(null)).toEqual([]);
        expect(parseWordExamples(undefined)).toEqual([]);
        expect(parseWordExamples('not json')).toEqual([]);
        expect(parseWordExamples('{"text":"x"}')).toEqual([]);
    });

    it('drops entries with no usable text', () => {
        expect(parseWordExamples('[{"text":"   "}, 42, null]')).toEqual([]);
    });
});

describe('serializeWordExamples', () => {
    it('round-trips through parse without empty fields', () => {
        const examples = [{ text: 'A sentence.', translation: 'Một câu.' }];
        expect(parseWordExamples(serializeWordExamples(examples))).toEqual(
            examples,
        );
        expect(serializeWordExamples([{ text: 'x' }])).toBe('[{"text":"x"}]');
    });
});

describe('mergeWordExamples', () => {
    it('keeps stored examples that the incoming batch does not have', () => {
        // The regression this whole util exists for: a word with seeded
        // examples must not lose them when Langeek returns nothing.
        const stored = [{ text: 'Seeded sentence.' }];
        expect(mergeWordExamples(stored, [])).toEqual(stored);
    });

    it('upgrades a duplicate in place instead of adding it twice', () => {
        const merged = mergeWordExamples(
            [{ text: 'She felt anxious.' }],
            [
                {
                    text: '  she felt   anxious.  ',
                    translation: 'Cô ấy lo lắng.',
                    audioUrl: 'https://cdn/a.mp3',
                },
            ],
        );
        expect(merged).toEqual([
            {
                text: 'She felt anxious.',
                translation: 'Cô ấy lo lắng.',
                audioUrl: 'https://cdn/a.mp3',
            },
        ]);
    });

    it('never overwrites a stored translation with an incoming one', () => {
        const merged = mergeWordExamples(
            [{ text: 'Same.', translation: 'Giữ nguyên.' }],
            [{ text: 'Same.', translation: 'Ghi đè.' }],
        );
        expect(merged[0].translation).toBe('Giữ nguyên.');
    });

    it('appends new examples after existing ones and honours the cap', () => {
        const stored = [{ text: 'One.' }];
        const incoming = [{ text: 'Two.' }, { text: 'Three.' }];
        expect(mergeWordExamples(stored, incoming).map((e) => e.text)).toEqual([
            'One.',
            'Two.',
            'Three.',
        ]);
        expect(mergeWordExamples(stored, incoming, 2)).toHaveLength(2);
    });
});

describe('hasClozeableExample', () => {
    it('requires the target word as a whole word', () => {
        const examples = [{ text: 'She felt anxious about the exam.' }];
        expect(hasClozeableExample('anxious', examples)).toBe(true);
        expect(hasClozeableExample('ANXIOUS', examples)).toBe(true);
        // Inflected forms do not qualify — the same gate the frontend applies.
        expect(hasClozeableExample('anxiety', examples)).toBe(false);
        // Substring matches must not count.
        expect(hasClozeableExample('exa', examples)).toBe(false);
    });

    it('is safe for words containing regex metacharacters', () => {
        expect(hasClozeableExample('c++', [{ text: 'I write c++ daily.' }])).toBe(
            false,
        );
        expect(hasClozeableExample('', [{ text: 'anything' }])).toBe(false);
    });
});
