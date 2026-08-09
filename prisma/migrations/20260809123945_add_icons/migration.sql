-- Icons for Domains and Pages
--
-- See NEW-IMPROVEMENTS.md §27 and Phase J.
--
-- Stores an ID, not a URL: the filename (without extension) of an SVG in `public/icons/`, e.g.
-- 'youtube'. The URL is derived as /icons/<id>.svg, which keeps the storage location an
-- implementation detail — if uploads are ever added (J-4), this same column can hold either kind
-- of reference with no further migration.
--
-- NO BACKFILL, AND NO DEFAULT. Both columns are nullable, and NULL is the meaningful value: it
-- means "fall back to the emoji already in the name/title", which is true of all 41 domains and
-- 1,216 pages today. There is nothing to compute for existing rows.
--
-- Contrast the two earlier status migrations, which are worth remembering as opposites:
--   20260806090354_add_domain_status  DEFAULT 'DRAFT' was WRONG for existing rows, and a
--                                     hand-written CASE backfill was the difference between
--                                     working and blanking the public homepage.
--   20260806144304_add_page_status    DEFAULT 'PUBLISHED' was RIGHT for existing rows, so a
--                                     bare ADD COLUMN sufficed.
-- This one needs neither, because absence is itself the correct state.
--
-- Safe to run BEFORE deploying the code: the deployed application does not know these columns
-- exist and ignores them. That ordering is required — the reverse would leave live code querying
-- columns that do not yet exist.

-- AlterTable
ALTER TABLE "public"."Domain" ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "public"."Page" ADD COLUMN     "icon" TEXT;
