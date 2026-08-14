-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ContentBlockType" ADD VALUE 'SECTION_HEADER';
ALTER TYPE "public"."ContentBlockType" ADD VALUE 'SECTION_LINKS';
ALTER TYPE "public"."ContentBlockType" ADD VALUE 'SUBCATEGORY_CARD';

-- AlterTable
ALTER TABLE "public"."Domain" ADD COLUMN     "pageType" TEXT NOT NULL DEFAULT 'direct';

-- AlterTable
ALTER TABLE "public"."Page" ADD COLUMN     "contentType" TEXT NOT NULL DEFAULT 'narrative';
