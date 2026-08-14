-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ContentBlockType" ADD VALUE 'TABLE_CONTAINER';
ALTER TYPE "public"."ContentBlockType" ADD VALUE 'TABLE_DESCRIPTION';

-- CreateTable
CREATE TABLE "public"."Table" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Table_pageId_key" ON "public"."Table"("pageId");

-- CreateIndex
CREATE INDEX "Table_pageId_idx" ON "public"."Table"("pageId");

-- AddForeignKey
ALTER TABLE "public"."Table" ADD CONSTRAINT "Table_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
