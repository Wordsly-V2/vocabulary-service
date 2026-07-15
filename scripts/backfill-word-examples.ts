import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * Backfill word_examples rows from the legacy `words.example` column
 * (a JSON-stringified array of sentence strings written during sync).
 *
 * - Cursor-paginates words where `example` is not null, in batches of 500.
 * - Idempotent: words that already have word_examples rows are skipped.
 * - Tolerates malformed / non-array `example` blobs (logs + skips, never throws
 *   mid-batch).
 *
 * Run with: npm run backfill:word-examples
 */

const BATCH_SIZE = 500;

async function main(): Promise<void> {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

    let cursor: string | undefined;
    let scanned = 0;
    let created = 0;
    let skippedExisting = 0;
    let skippedMalformed = 0;

    try {
        for (;;) {
            const words = await prisma.word.findMany({
                where: { example: { not: null } },
                select: {
                    id: true,
                    example: true,
                    _count: { select: { examples: true } },
                },
                orderBy: { id: 'asc' },
                take: BATCH_SIZE,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
            });

            if (words.length === 0) break;

            for (const word of words) {
                scanned++;

                // Idempotent: skip words that already have examples.
                if (word._count.examples > 0) {
                    skippedExisting++;
                    continue;
                }

                let parsed: unknown;
                try {
                    parsed = JSON.parse(word.example as string);
                } catch {
                    skippedMalformed++;
                    console.warn(
                        `[skip] word ${word.id}: example is not valid JSON`,
                    );
                    continue;
                }

                if (!Array.isArray(parsed)) {
                    skippedMalformed++;
                    console.warn(
                        `[skip] word ${word.id}: parsed example is not an array`,
                    );
                    continue;
                }

                const rows = parsed
                    .map((item, index) => ({ item, index }))
                    .filter(
                        ({ item }) =>
                            typeof item === 'string' && item.trim().length > 0,
                    )
                    .map(({ item, index }) => ({
                        id: uuidv7(),
                        wordId: word.id,
                        text: item as string,
                        orderIndex: index,
                    }));

                if (rows.length === 0) {
                    skippedMalformed++;
                    console.warn(
                        `[skip] word ${word.id}: no usable example strings`,
                    );
                    continue;
                }

                const result = await prisma.wordExample.createMany({
                    data: rows,
                });
                created += result.count;
            }

            cursor = words[words.length - 1].id;
            if (words.length < BATCH_SIZE) break;
        }

        console.log(
            `Backfill complete. Scanned: ${scanned}, examples created: ${created}, ` +
                `words skipped (already had examples): ${skippedExisting}, ` +
                `words skipped (malformed/empty): ${skippedMalformed}.`,
        );
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
