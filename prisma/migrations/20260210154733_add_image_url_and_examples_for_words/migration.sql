-- AlterTable
ALTER TABLE "words" ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "WordExample" (
    "id" UUID NOT NULL,
    "wordId" UUID NOT NULL,
    "example" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WordExample_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WordExample" ADD CONSTRAINT "WordExample_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;
