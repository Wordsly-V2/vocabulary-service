-- Word progress (spaced repetition) moved to learning-service, which keeps it
-- in its own database keyed by wordId and drops rows on WORDS_DELETED_TOPIC.
-- The model was removed from schema.prisma without a migration, leaving this
-- table (and its FK to "words") behind as drift. Nothing here reads or writes
-- it. Its FK is ON DELETE CASCADE, so it never blocked a word delete, and the
-- previous migration's FK rewrite on "lessons"/"words" does not touch it —
-- the two can run in either order. IF EXISTS because databases bootstrapped
-- with `db push` from the current schema never had it; DROP TABLE also drops
-- its FK constraint and indexes.

-- DropTable
DROP TABLE IF EXISTS "word_progress";
