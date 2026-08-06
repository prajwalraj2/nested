-- Page lifecycle status: DRAFT | PUBLISHED | UPCOMING
--
-- See NEW-IMPROVEMENTS.md §25.
--
-- ⚠️ NO BACKFILL HERE, AND THAT IS CORRECT — unlike 20260806090354_add_domain_status, which
-- needed one badly.
--
-- The Domain migration defaulted to 'DRAFT', which was the wrong value for existing rows: it
-- would have marked all 37 live domains as drafts and blanked the public homepage, so a
-- hand-written `UPDATE ... CASE WHEN "isPublished"` had to be added.
--
-- Here the default is 'PUBLISHED', which IS the correct value for every existing row — all
-- 1,205 pages are currently live, because until now `Page` had no status concept at all.
-- `ADD COLUMN ... NOT NULL DEFAULT 'PUBLISHED'` therefore sets them all correctly on its own.
--
-- The default is PUBLISHED rather than DRAFT because two of the five `prisma.page.create` call
-- sites are side effects of *domain* operations (creating a direct domain creates its
-- `__main__` page; changing a domain's pageType recreates it). A DRAFT default would make those
-- produce an invisible `__main__`, and the whole domain root would 404. See the field comment
-- in schema.prisma.
--
-- Safe to run BEFORE deploying the new code: the currently-deployed code does not know this
-- column exists and ignores it. That ordering is required — the reverse would leave live code
-- querying a column that does not yet exist.

-- CreateEnum
CREATE TYPE "public"."PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UPCOMING');

-- AlterTable
ALTER TABLE "public"."Page" ADD COLUMN     "status" "public"."PageStatus" NOT NULL DEFAULT 'PUBLISHED';
