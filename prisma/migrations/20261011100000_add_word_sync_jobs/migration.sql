-- Admin Langeek sync (A-11): per-word CEFR level and last sync time, and the
-- sync runs with their per-word log. Status/scope/mode are TEXT, checked in code.

-- AlterTable
ALTER TABLE "words" ADD COLUMN "cefr_level" TEXT;
ALTER TABLE "words" ADD COLUMN "langeek_synced_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "word_sync_jobs" (
    "id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "target_id" UUID,
    "scope_label" TEXT NOT NULL,
    "fields" TEXT[],
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retry_of_id" UUID,
    "total" INTEGER NOT NULL DEFAULT 0,
    "done" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errored" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "word_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_sync_items" (
    "job_id" UUID NOT NULL,
    "word_id" UUID NOT NULL,
    "word" TEXT NOT NULL,
    "part_of_speech" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "changed_fields" TEXT[],
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "word_sync_items_pkey" PRIMARY KEY ("job_id","word_id")
);

-- CreateIndex
CREATE INDEX "word_sync_jobs_status_idx" ON "word_sync_jobs"("status");
CREATE INDEX "word_sync_jobs_created_at_idx" ON "word_sync_jobs"("created_at");
CREATE INDEX "word_sync_items_job_id_status_idx" ON "word_sync_items"("job_id", "status");

-- AddForeignKey
ALTER TABLE "word_sync_items" ADD CONSTRAINT "word_sync_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "word_sync_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
