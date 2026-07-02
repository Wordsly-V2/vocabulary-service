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
- Consuming: one thin consumer per feature (e.g. `src/dictionary/dictionary.consumer.ts`) that parses the payload, delegates to the feature service, then commits. HTTP stays in controllers, Kafka in consumers.

### Internal-only API

Every HTTP controller is guarded by `InternalServiceGuard` (`src/guard/internal-service/`), which requires an `x-service-token` header equal to `INTERNAL_SERVICE_TO_SERVICE_TOKEN`. This service is only called by the gateway and other services, never by browsers directly. The guard skips non-HTTP contexts so Kafka handlers pass through.

Routes are user-scoped: `users/:userLoginId/courses/:courseId/lessons/:lessonId/words`. There is no users table here — `userLoginId` is just a UUID column on `Course`; ownership checks walk the Course → Lesson → Word chain.

### Data + caching

- Prisma 7 + PostgreSQL, schema in `prisma/schema.prisma`: `Course → Lesson → Word`. Prisma is only accessed via `PrismaService` inside services, never in controllers.
- Postgres does not auto-index FK columns and nearly every query here walks the ownership chain — any new relation/filter column needs an explicit `@@index` (the FK indexes on `courses.userLoginId`, `lessons.courseId`, `words.lessonId` were added for exactly this reason).
- Redis caching via `CacheService` (`src/cache/`), disabled gracefully if `REDIS_URL` is unset:
  - `getOrSet(userLoginId, keyParts, factory, kind)` for user-scoped data (keys prefixed `vocab:u:<userLoginId>:`), `getOrSetGlobal` for shared data (e.g. dictionary lookups).
  - Key builders live in `src/cache/cache-keys.ts`; per-kind TTLs in `src/cache/cache-ttl.ts`.
  - Writes invalidate with `invalidateUser(userLoginId)` (wildcard delete of the user's keys); TTLs are only a safety net. Any mutation in a feature service must call it.

### Feature modules

- `courses`, `course-lessons`, `course-lesson-words` — CRUD for the content hierarchy. Deleting words emits `WORDS_DELETED_TOPIC` so learning-service can drop word progress.
- `word-scope` — internal query API for learning-service (scoped word IDs, ownership filtering, grouping by lesson/course).
- `dictionary` — Cambridge lookups via `@perqueza72/cambridge-dictionary-scraper` + cheerio, and Langeek lookups by scraping the Next.js build ID. Word sync runs through Kafka, one message per word.

### Conventions

- Path alias `@/*` → `src/*`.
- DTOs with class-validator for every endpoint (global `ValidationPipe` with `whitelist` + `transform`); never return raw Prisma models.
- Controllers stay thin; business logic lives in services. Feature-based modules, kebab-case folders, `*.service.ts` / `*.controller.ts` / `*.module.ts` naming.
- 4-space indentation, single quotes (`.prettierrc`).
