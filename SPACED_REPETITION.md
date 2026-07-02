# Spaced Repetition — moved to learning-service

Word progress and review scheduling no longer live in vocabulary-service.
The `WordProgress` model and its endpoints were migrated to **learning-service**,
and the algorithm was upgraded from SuperMemo SM-2 to **FSRS** (via `ts-fsrs`).

Where things live now:

- Scheduler (FSRS config, grading, interval math):
  `learning-service/src/word-progress/word-progress-scheduler.ts`
- Recording answers, due-word selection, stats:
  `learning-service/src/word-progress/word-progress.service.ts`
- Data model (`word_progress` table with FSRS state):
  `learning-service/prisma/schema.prisma`

Key behaviors:

- Answers are still submitted on the 0–5 quality scale and mapped to FSRS
  grades (`<3` → Again, `3` → Hard, `4` → Good, `5` → Easy).
- Target retention 90%, intervals capped at 365 days, fuzz enabled so reviews
  of words learned together spread across neighboring days.
- Legacy SM-2 rows (stability = 0) are migrated on the fly the first time they
  are reviewed.

vocabulary-service now only owns content (courses, lessons, words) and the
dictionary integration.
