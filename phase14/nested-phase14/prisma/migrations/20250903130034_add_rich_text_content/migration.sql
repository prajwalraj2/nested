-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ContentBlockType" ADD VALUE 'RICH_TEXT_CONTAINER';
ALTER TYPE "public"."ContentBlockType" ADD VALUE 'RICH_TEXT_SECTION';
ALTER TYPE "public"."ContentBlockType" ADD VALUE 'RICH_TEXT_EDITOR';

-- CreateTable
CREATE TABLE "public"."RichTextContent" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "title" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "characterCount" INTEGER NOT NULL DEFAULT 0,
    "lastEditedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "htmlContent" TEXT,
    "plainText" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RichTextContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RichTextContent_pageId_key" ON "public"."RichTextContent"("pageId");

-- CreateIndex
CREATE INDEX "RichTextContent_pageId_idx" ON "public"."RichTextContent"("pageId");

-- AddForeignKey
ALTER TABLE "public"."RichTextContent" ADD CONSTRAINT "RichTextContent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
