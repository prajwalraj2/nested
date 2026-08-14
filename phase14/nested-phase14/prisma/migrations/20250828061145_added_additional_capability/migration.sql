-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ContentBlockType" ADD VALUE 'LINK_BUTTON';
ALTER TYPE "public"."ContentBlockType" ADD VALUE 'NAVIGATION';
ALTER TYPE "public"."ContentBlockType" ADD VALUE 'SECTION_DIVIDER';
ALTER TYPE "public"."ContentBlockType" ADD VALUE 'IMAGE';
ALTER TYPE "public"."ContentBlockType" ADD VALUE 'VIDEO';
ALTER TYPE "public"."ContentBlockType" ADD VALUE 'QUOTE';
