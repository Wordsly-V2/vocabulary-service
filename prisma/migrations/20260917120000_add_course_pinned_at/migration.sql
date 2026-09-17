-- AddColumn
ALTER TABLE "courses" ADD COLUMN "pinned_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "courses_userLoginId_pinned_at_idx" ON "courses"("userLoginId", "pinned_at");
