# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this service is

Vocabulary content microservice for Wordsly V2. It owns **courses, lessons, words** and the **dictionary integration** (Cambridge + Langeek scraping). Spaced repetition / word progress was migrated to **learning-service** (see `SPACED_REPETITION.md`) — the README's spaced-repetition section is outdated.

## Commands

```bash
npm run start:dev          # dev server with watch (HTTP on PORT, default 3002)
npm run build              # prisma generate + nest build
npm run lint               # eslint --fix
npm run test               # unit tests (jest, rootDir=src, matches *.spec.ts)
npx jest path/to/file.spec.ts        # single test file
npx jest -t "test name"              # single test by name
npm run test:e2e           # e2e tests (test/jest-e2e.json)
npx prisma migrate dev     # create/apply migrations (uses DATABASE_URL via prisma.config.ts)
npx prisma generate        # regenerate client after schema changes
```

Env comes from `.env` (see `.env.example`). Required vars are validated at boot by `src/config/validate-env.ts`; all config is read through `src/config/configuration.ts` (never `process.env` directly in features).

## Architecture

### Hybrid app: HTTP + Kafka

`src/main.ts` boots a NestJS HTTP app (Swagger at `/api`) **and** connects a Kafka microservice with `run.autoCommit: false`. Consequence: every Kafka `@EventPattern` handler must call `commitCurrentMessage(context)` (`src/messaging/kafka-helpers.ts`) after successful processing, or the message is redelivered on restart.

Kafka layout:
- Topic names live only in `src/messaging/constants.ts` — producers and consumers both import from there.
- Producing: inject `KafkaProducerService` (`src/messaging/`). It is a silent no-op when `KAFKA_BROKERS` is empty, so Kafka is optional in local dev.
- Consuming: one thin consumer per feature (e.g. `src/dictionary/dictionary.consumer.ts`) that parses the payload, delegates to the feature service, then commits. HTTP stays in controllers, Kafka in consumers. Every consumed topic goes in `CONSUMED_TOPICS` (`constants.ts`); `ensureTopics` creates missing ones at boot before the consumer subscribes.
- `USER_DELETED_TOPIC` (`src/user-data/`, from auth-service's outbox when an admin deletes an account): deletes the user's courses (lessons and words cascade) and clears their cache. It publishes **no** `words_deleted`, since learning-service purges the same user on the same event. Idempotent.

### Auth and scoping

Two global guards, registered as `APP_GUARD` in `app.module.ts` and living in `src/auth/jwt/`:

- `AccessGuard` — deny-by-default. Two ways in: `@Public()` (health only), or a valid RS256 access token verified against `AUTH_JWKS_URI`. A JWKS fetch failure is a **503, not a 401**: "I could not check this token" must not sign learners out and wipe their offline cache.
- `RolesGuard` — runs right after AccessGuard; a route marked `@Roles('admin')` needs that role in the access token's `roles` claim (403 otherwise). No-op without the decorator.
- `UserScopeGuard` — refuses any request carrying a user id in its path or query string, except on an `@Roles('admin')` route called by an admin (admin routes act on a named user by design). Admin routes live under `/admin/vocabulary`.

Both return `true` immediately for non-HTTP contexts, so Kafka handlers pass through.

**Handlers never read a user id from the request.** Routes are `courses/:courseId/lessons/:lessonId/words` — no user segment — and the id comes from `@CurrentUser()`, which returns the access token's subject. Routes used to be `users/:userLoginId/...` with a guard comparing the segment against the token; the id was still client-supplied, so every new route was one missed check away from serving someone else's rows.

There is no users table here — `userLoginId` is just a UUID column on `Course`; ownership checks walk the Course → Lesson → Word chain, and every query filters on it (`course: { userLoginId, id: courseId }`) rather than trusting the URL prefix.

learning-service calls the `word-scope` endpoints with the **end user's own access token**, forwarded, so those requests are checked exactly like a browser's.

### Data + caching

- Prisma 7 + PostgreSQL, schema in `prisma/schema.prisma`: `Course → Lesson → Word`. Prisma is only accessed via `PrismaService` inside services, never in controllers.
- Postgres does not auto-index FK columns and nearly every query here walks the ownership chain — any new relation/filter column needs an explicit `@@index` (the FK indexes on `courses.userLoginId`, `lessons.courseId`, `words.lessonId` were added for exactly this reason).
- Redis caching via `CacheService` (`src/cache/`), disabled gracefully if `REDIS_URL` is unset:
  - `getOrSet(userLoginId, keyParts, factory, kind)` for user-scoped data (keys prefixed `vocab:u:<userLoginId>:`), `getOrSetGlobal` for shared data (e.g. dictionary lookups).
  - Key builders live in `src/cache/cache-keys.ts`; per-kind TTLs in `src/cache/cache-ttl.ts`.
  - Global keys under one prefix are dropped with `invalidateGlobal(prefix)` (official courses use it).
  - Writes invalidate with `invalidateUser(userLoginId)` (wildcard delete of the user's keys); TTLs are only a safety net. Any mutation in a feature service must call it.

### Feature modules

- `courses`, `course-lessons`, `course-lesson-words` — CRUD for the content hierarchy. Deleting words emits `WORDS_DELETED_TOPIC` so learning-service can drop word progress.
- `word-scope` — internal query API for learning-service (scoped word IDs, ownership filtering, grouping by lesson/course).
- `admin-vocabulary` — `@Roles('admin')` under `/admin/vocabulary`: `GET users/:id/courses` (totals + courses newest first, page size capped at 50), `GET users/:id/courses/:courseId` (lessons with words), `PUT`/`DELETE` a course, a lesson (`…/lessons/:lessonId`) or a word (`…/lessons/:lessonId/words/:wordId`), `POST users/:id/courses/:courseId/words/delete {wordIds}`. Every call goes through the learner-facing services with the target's `userLoginId`, so ownership checks, cache invalidation and `words_deleted` behave exactly as for the learner; writes log `admin_action`. `GET health?limit` (not cached): words missing IPA (`ukIpa`, `usIpa` and `pronunciation` all blank), audio (`audioUrl`, `ukAudioUrl`, `usAudioUrl`), meaning, example (blank or the JSON `[]` the learner's word form saves for "no examples") and image (optional), overall and for the courses with the most incomplete words.
- `official-courses` — courses with no owner (`userLoginId` NULL) that admins author and learners copy. Its own service with every query pinned to `userLoginId: null`; the learner services keep taking the caller's id as a `string`, so no learner route can reach an official course (they answer 404). Admin, `@Roles('admin')` under `/admin/vocabulary/courses`: list (drafts and published, `?status=draft|published`, newest first), create (a draft), get, rename, delete, `POST :id/publish` (400 without a word; publishing again keeps the first `publishedAt`) and `:id/unpublish`, lessons (create appends, update, delete) and words (create, update, `POST :id/words/delete {wordIds}`); writes log `admin_action`, deletes publish `words_deleted` as usual. Learner, under `/courses/official` (its module is imported **before** `CoursesModule` so `GET /courses/:courseId` doesn't claim the path): `GET` (published, paged, each with the caller's newest copy as `copiedCourseId`), `GET :id` (a published course with lessons and words), `POST :id/copy` (one transaction: new course with `sourceCourseId`, lessons renumbered in order, words with every column of `COPIED_WORD_FIELDS`, a spec checks that list against the Word model; copying twice makes two copies). Published courses are cached globally (`officialCacheKeys`, `CacheKind.Official`) and every admin write drops them with `invalidateGlobal(OFFICIAL_CACHE_PREFIX)`; admin reads aren't cached. A copy is an ordinary course of the learner's, so FSRS, `word-scope`, `words_deleted` and the account purge treat it like any other.
- `dictionary` — Cambridge lookups via `@perqueza72/cambridge-dictionary-scraper` + cheerio, and Langeek lookups by scraping the Next.js build ID (the sense's `level` gives `words.cefr_level`, A1–C2 only). Word sync runs through Kafka, one message per word on `DICTIONARY_SYNC_WORD_LANGEEK_TOPIC`. What a sync writes is `planWordUpdate` (`word-sync.logic.ts`, tested): field groups (image, meaning, examples, pronunciation, level) and a mode (`fill_missing`: blank columns only; `overwrite`: whatever Langeek has, examples replaced; `merge`: the learner sync, examples merged). It never writes a blank. Every processed word gets `langeekSyncedAt`; an official word drops the catalogue cache, an owned one the owner's. The learner sync (`POST /dictionary/sync-words-langeek`) keeps its 24h Redis job; a message carrying `adminJobId` belongs to an admin run instead (see below).
- `admin-dictionary-sync` — `@Roles('admin')` under `/admin/vocabulary/sync`: `POST preview` (word count for a scope), `POST jobs` (start: `scope` all/official/user/course/lesson/words/health + `targetId`/`wordIds`, `fields`, `mode`; 409 while another run is `running`, under an advisory lock; 503 when Kafka isn't reachable; 400 for an empty scope), `GET jobs`, `GET jobs/:id`, `GET jobs/:id/items`, `POST jobs/:id/cancel`, `POST jobs/:id/retry` (new run over the failed and pending words). Runs live in Postgres: `word_sync_jobs` (counters, status `running|completed|cancelled|failed`) and `word_sync_items` (primary key job + word, so the selection is one `INSERT … SELECT` and a redelivered message can't count twice). The consumer reads the run's fields, mode and status (cached 3s; a stopped run's words are committed without fetching), runs `processOneWordSync` with `refresh: true` (skips the 7-day dictionary cache), then `record` marks the pending item and bumps the counters in one transaction, flipping the run to completed with its last count. It pauses `LANGEEK_SYNC_DELAY_MS` (default 300) between words. The `health` scope reuses the content-health predicates in `admin-vocabulary/word-health.sql.ts`.

### Conventions

- Path alias `@/*` → `src/*`.
- DTOs with class-validator for every endpoint (global `ValidationPipe` with `whitelist` + `transform`); never return raw Prisma models.
- Controllers stay thin; business logic lives in services. Feature-based modules, kebab-case folders, `*.service.ts` / `*.controller.ts` / `*.module.ts` naming.
- 4-space indentation, single quotes (`.prettierrc`).

## Database rules

- **Never use database enums** (workspace-wide rule, see `../../CLAUDE.md`): no Prisma `enum`, no `CREATE TYPE … AS ENUM`. Use `String` columns; the allowed values live in code as an `as const` list + union type and are validated at the boundary.
