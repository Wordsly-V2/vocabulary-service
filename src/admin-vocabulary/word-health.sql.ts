import { Prisma } from '@prisma/client';

/**
 * Content-health tests over words aliased `w`, shared by the health report and
 * the admin Langeek sync's `health` scope so "incomplete" means one thing.
 */

/** Blank-or-null, the same test for every column the health check reads. */
const empty = (column: string) =>
    Prisma.raw(`nullif(trim(w."${column}"), '') IS NULL`);

export const MISSING_IPA = Prisma.sql`(${empty('ukIpa')} AND ${empty('usIpa')} AND ${empty('pronunciation')})`;
export const MISSING_AUDIO = Prisma.sql`(${empty('audioUrl')} AND ${empty('ukAudioUrl')} AND ${empty('usAudioUrl')})`;
export const MISSING_MEANING = Prisma.sql`${empty('meaning')}`;
// The learner's word form saves "no examples" as the JSON `[]`.
export const MISSING_EXAMPLE = Prisma.raw(
    `coalesce(nullif(trim(w."example"), ''), '[]') = '[]'`,
);
export const MISSING_IMAGE = Prisma.sql`(${empty('imageUrl')} AND ${empty('imageThumbnailUrl')})`;

/** Missing IPA, audio, meaning or example (an image is optional). */
export const INCOMPLETE = Prisma.sql`(${MISSING_IPA} OR ${MISSING_AUDIO} OR ${MISSING_MEANING} OR ${MISSING_EXAMPLE})`;
