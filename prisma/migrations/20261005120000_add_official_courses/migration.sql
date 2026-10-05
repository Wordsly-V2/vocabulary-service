-- Official courses: courses with no owner ("userLoginId" IS NULL) that admins
-- publish and learners copy into their library.

-- AddColumn
ALTER TABLE "courses" ADD COLUMN "published_at" TIMESTAMPTZ;
ALTER TABLE "courses" ADD COLUMN "source_course_id" UUID;

-- CreateIndex
CREATE INDEX "courses_userLoginId_published_at_idx" ON "courses"("userLoginId", "published_at");
CREATE INDEX "courses_userLoginId_source_course_id_idx" ON "courses"("userLoginId", "source_course_id");
