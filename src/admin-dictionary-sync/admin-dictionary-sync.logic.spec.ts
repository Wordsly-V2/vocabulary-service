import {
    counterFor,
    percentDone,
    scopeCondition,
    scopeProblem,
} from './admin-dictionary-sync.logic';

const ID = '0190a000-0000-7000-8000-000000000001';

/** The SQL text with placeholders, and its bound values. */
const sql = (input: Parameters<typeof scopeCondition>[0]) => {
    const query = scopeCondition(input);
    return {
        text: query.sql.replace(/\s+/g, ' ').trim(),
        values: query.values,
    };
};

describe('scopeCondition', () => {
    it('covers every word for all', () => {
        expect(sql({ scope: 'all' }).text).toBe('TRUE');
    });

    it('pins official to owner-less courses', () => {
        expect(sql({ scope: 'official' }).text).toBe('c."userLoginId" IS NULL');
    });

    it.each([
        ['user', 'c."userLoginId" = ?::uuid'],
        ['course', 'c."id" = ?::uuid'],
        ['lesson', 'w."lessonId" = ?::uuid'],
    ] as const)('binds the target for %s', (scope, text) => {
        expect(sql({ scope, targetId: ID })).toEqual({ text, values: [ID] });
    });

    it('binds the word ids as one array', () => {
        expect(sql({ scope: 'words', wordIds: [ID] })).toEqual({
            text: 'w."id" = ANY(?::uuid[])',
            values: [[ID]],
        });
    });

    it('takes incomplete or image-less words for health, over a course if given', () => {
        const all = sql({ scope: 'health' });
        expect(all.text).toContain('nullif(trim(w."imageUrl")');
        expect(all.text).toContain('w."example"');
        expect(all.values).toEqual([]);

        const one = sql({ scope: 'health', targetId: ID });
        expect(one.text).toMatch(/AND c\."id" = \?::uuid$/);
        expect(one.values).toEqual([ID]);
    });

    it("takes the earlier run's failed and unfinished words for retry", () => {
        const retry = sql({ scope: 'retry', targetId: ID });
        expect(retry.text).toContain(`"status" IN ('error', 'pending')`);
        expect(retry.values).toEqual([ID]);
    });
});

describe('scopeProblem', () => {
    it.each(['user', 'course', 'lesson', 'retry'] as const)(
        'needs a target for %s',
        (scope) => {
            expect(scopeProblem({ scope })).toMatch(/targetId/);
            expect(scopeProblem({ scope, targetId: ID })).toBeNull();
        },
    );

    it('needs word ids for words', () => {
        expect(scopeProblem({ scope: 'words', wordIds: [] })).toMatch(
            /wordIds/,
        );
        expect(scopeProblem({ scope: 'words', wordIds: [ID] })).toBeNull();
    });

    it('needs nothing for all, official and health', () => {
        expect(scopeProblem({ scope: 'all' })).toBeNull();
        expect(scopeProblem({ scope: 'official' })).toBeNull();
        expect(scopeProblem({ scope: 'health' })).toBeNull();
    });
});

describe('helpers', () => {
    it('maps outcomes to counters', () => {
        expect(counterFor('updated')).toBe('updated');
        expect(counterFor('skipped')).toBe('skipped');
        expect(counterFor('error')).toBe('errored');
    });

    it('rounds progress down and caps it', () => {
        expect(percentDone(0, 3)).toBe(0);
        expect(percentDone(2, 3)).toBe(66);
        expect(percentDone(3, 3)).toBe(100);
        expect(percentDone(0, 0)).toBe(100);
    });
});
