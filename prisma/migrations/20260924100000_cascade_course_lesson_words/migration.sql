-- Deleting a non-empty course or lesson failed with P2003: both FKs were
-- created ON DELETE RESTRICT. The services now delete the words themselves
-- (so they can publish WORDS_DELETED_TOPIC with the ids), and CASCADE is the
-- backstop that keeps a parent delete from failing on a child row.

-- DropForeignKey
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_courseId_fkey";

-- DropForeignKey
ALTER TABLE "words" DROP CONSTRAINT "words_lessonId_fkey";

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "words" ADD CONSTRAINT "words_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
