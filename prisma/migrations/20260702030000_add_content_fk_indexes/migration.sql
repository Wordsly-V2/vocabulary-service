-- Every ownership/access query joins words -> lessons -> courses.userLoginId.
-- Postgres does not auto-index FK columns, so these were all sequential scans.

-- CreateIndex
CREATE INDEX "courses_userLoginId_idx" ON "courses"("userLoginId");

-- CreateIndex
CREATE INDEX "lessons_courseId_idx" ON "lessons"("courseId");

-- CreateIndex
CREATE INDEX "words_lessonId_idx" ON "words"("lessonId");
