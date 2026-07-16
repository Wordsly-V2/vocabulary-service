/*
  Warnings:

  - You are about to drop the `word_examples` table. If the table is not empty, all the data it contains will be lost.
    Examples are now stored as a JSON-encoded array in the `words.example` column.

*/
-- DropForeignKey
ALTER TABLE "word_examples" DROP CONSTRAINT "word_examples_wordId_fkey";

-- DropTable
DROP TABLE "word_examples";
