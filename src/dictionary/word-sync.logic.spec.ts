import {
    normalizeCefrLevel,
    planWordUpdate,
    SYNC_FIELDS,
    type SyncedWord,
} from './word-sync.logic';

const blank: SyncedWord = {
    imageUrl: null,
    imageThumbnailUrl: null,
    meaning: '',
    pronunciation: null,
    audioUrl: null,
    ukAudioUrl: null,
    usAudioUrl: null,
    ukIpa: null,
    usIpa: null,
    cefrLevel: null,
    partOfSpeech: null,
    example: null,
};

const filled: SyncedWord = {
    imageUrl: 'old.jpg',
    imageThumbnailUrl: 'old-thumb.jpg',
    meaning: 'cũ',
    pronunciation: 'old',
    audioUrl: 'old.mp3',
    ukAudioUrl: 'old-uk.mp3',
    usAudioUrl: 'old-us.mp3',
    ukIpa: 'uk',
    usIpa: 'us',
    cefrLevel: 'A1',
    partOfSpeech: 'noun',
    example: JSON.stringify([{ text: 'Old example.' }]),
};

const fetched = {
    imageUrl: 'new.jpg',
    imageThumbnailUrl: 'new-thumb.jpg',
    meaning: 'mới',
    pronunciation: 'new',
    audioUrl: 'new.mp3',
    ukAudioUrl: 'new-uk.mp3',
    usAudioUrl: undefined,
    ukIpa: 'nuk',
    usIpa: '',
    cefrLevel: 'B2',
    partOfSpeech: 'noun',
    examples: [{ text: 'New example.', translation: 'Ví dụ mới.' }],
};

describe('planWordUpdate', () => {
    it('fills every blank column of the chosen groups', () => {
        const plan = planWordUpdate(
            blank,
            fetched,
            SYNC_FIELDS,
            'fill_missing',
        );
        expect(plan.data).toEqual({
            imageUrl: 'new.jpg',
            imageThumbnailUrl: 'new-thumb.jpg',
            meaning: 'mới',
            pronunciation: 'new',
            audioUrl: 'new.mp3',
            ukAudioUrl: 'new-uk.mp3',
            ukIpa: 'nuk',
            cefrLevel: 'B2',
            partOfSpeech: 'noun',
            example: JSON.stringify([
                { text: 'New example.', translation: 'Ví dụ mới.' },
            ]),
        });
        expect(plan.changedFields).toEqual([...SYNC_FIELDS]);
    });

    it('leaves filled columns alone in fill_missing', () => {
        const plan = planWordUpdate(
            filled,
            fetched,
            SYNC_FIELDS,
            'fill_missing',
        );
        expect(plan).toEqual({ data: {}, changedFields: [] });
    });

    it('fills a blank column next to a filled one in the same group', () => {
        const plan = planWordUpdate(
            { ...filled, ukIpa: ' ' },
            fetched,
            ['pronunciation'],
            'fill_missing',
        );
        expect(plan.data).toEqual({ ukIpa: 'nuk' });
        expect(plan.changedFields).toEqual(['pronunciation']);
    });

    it('overwrites with what Langeek has, never with a blank', () => {
        const plan = planWordUpdate(filled, fetched, SYNC_FIELDS, 'overwrite');
        expect(plan.data.imageUrl).toBe('new.jpg');
        expect(plan.data.meaning).toBe('mới');
        expect(plan.data.cefrLevel).toBe('B2');
        // Blank or missing from Langeek: kept.
        expect(plan.data).not.toHaveProperty('usAudioUrl');
        expect(plan.data).not.toHaveProperty('usIpa');
        // Same value: not a change.
        expect(plan.data).not.toHaveProperty('partOfSpeech');
        // Overwrite replaces the examples.
        expect(JSON.parse(plan.data.example!)).toEqual([
            { text: 'New example.', translation: 'Ví dụ mới.' },
        ]);
    });

    it('only touches the chosen groups', () => {
        const plan = planWordUpdate(blank, fetched, ['image'], 'overwrite');
        expect(Object.keys(plan.data).sort()).toEqual([
            'imageThumbnailUrl',
            'imageUrl',
        ]);
        expect(plan.changedFields).toEqual(['image']);
    });

    it('merges examples in merge mode (the learner sync)', () => {
        const plan = planWordUpdate(filled, fetched, ['examples'], 'merge');
        expect(JSON.parse(plan.data.example!)).toEqual([
            { text: 'Old example.' },
            { text: 'New example.', translation: 'Ví dụ mới.' },
        ]);
    });

    it('treats the stored [] as no examples', () => {
        const plan = planWordUpdate(
            { ...blank, example: '[]' },
            fetched,
            ['examples'],
            'fill_missing',
        );
        expect(plan.changedFields).toEqual(['examples']);
    });

    it('does not report unchanged examples', () => {
        const plan = planWordUpdate(
            { ...blank, example: JSON.stringify(fetched.examples) },
            fetched,
            ['examples'],
            'overwrite',
        );
        expect(plan).toEqual({ data: {}, changedFields: [] });
    });

    it('leaves examples alone when Langeek has none', () => {
        const plan = planWordUpdate(
            blank,
            { examples: [] },
            ['examples'],
            'overwrite',
        );
        expect(plan.data).toEqual({});
    });
});

describe('normalizeCefrLevel', () => {
    it('keeps A1–C2 only', () => {
        expect(normalizeCefrLevel(' b2 ')).toBe('B2');
        expect(normalizeCefrLevel('C2')).toBe('C2');
        expect(normalizeCefrLevel('D1')).toBeUndefined();
        expect(normalizeCefrLevel(3)).toBeUndefined();
        expect(normalizeCefrLevel(undefined)).toBeUndefined();
    });
});
