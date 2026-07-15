-- AlterTable
ALTER TABLE "words" ADD COLUMN     "ukAudioUrl" TEXT,
ADD COLUMN     "usAudioUrl" TEXT,
ADD COLUMN     "ukIpa" TEXT,
ADD COLUMN     "usIpa" TEXT,
ADD COLUMN     "imageThumbnailUrl" TEXT,
ADD COLUMN     "wordForms" JSONB;

-- CreateTable
CREATE TABLE "word_examples" (
    "id" UUID NOT NULL,
    "wordId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "translation" TEXT,
    "audioUrl" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "word_examples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "word_examples_wordId_idx" ON "word_examples"("wordId");

-- AddForeignKey
ALTER TABLE "word_examples" ADD CONSTRAINT "word_examples_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;
