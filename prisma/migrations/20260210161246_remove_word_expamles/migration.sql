/*
  Warnings:

  - You are about to drop the `WordExample` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WordExample" DROP CONSTRAINT "WordExample_wordId_fkey";

-- AlterTable
ALTER TABLE "words" ADD COLUMN     "example" TEXT;

-- DropTable
DROP TABLE "WordExample";
