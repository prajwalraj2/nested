-- Domain lifecycle status: DRAFT | PUBLISHED | UPCOMING
--
-- Replaces the two-state `isPublished` boolean. See NEW-IMPROVEMENTS.md §24.
--
-- ⚠️ THE BACKFILL AT THE BOTTOM IS NOT OPTIONAL AND WAS ADDED BY HAND.
--
-- Prisma generated only the CREATE TYPE and the ADD COLUMN. That column defaults to 'DRAFT',
-- so applying the generated migration unmodified would mark EVERY EXISTING DOMAIN AS DRAFT --
-- all 37 of them on production -- and the public site reads `status` to decide what to list.
-- The homepage would go blank. The UPDATE restores each row's real state from the boolean it
-- is replacing.
--
-- Safe to run BEFORE deploying the new code: the currently-deployed code reads `isPublished`
-- and ignores a column it does not know about. That ordering is required, because the reverse
-- would leave live code querying a column that does not yet exist.

-- CreateEnum
CREATE TYPE "public"."DomainStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UPCOMING');

-- AlterTable
ALTER TABLE "public"."Domain" ADD COLUMN     "status" "public"."DomainStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill from the column this replaces.
--
-- No row can map to UPCOMING: that state did not exist before this migration, so nothing in
-- the old data could have meant it. Every domain is therefore PUBLISHED or DRAFT, exactly
-- mirroring `isPublished`.
UPDATE "public"."Domain"
SET "status" = CASE WHEN "isPublished" THEN 'PUBLISHED'::"public"."DomainStatus"
                    ELSE 'DRAFT'::"public"."DomainStatus"
               END;
