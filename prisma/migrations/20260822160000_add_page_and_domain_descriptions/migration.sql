-- #38 / Phase O-1: page and domain descriptions, plus authored meta descriptions.
--
-- Four columns across two models, all additive and nullable, so every existing row becomes NULL —
-- which means "render nothing" and "fall back to the generated meta description". Applying this
-- ahead of the code changes NOTHING that is visible on any of the 1,236 pages or 43 domains.
--
-- ⚠️ THE `UPDATE` AT THE BOTTOM IS THE PART TO WATCH. It is the only statement here that moves
-- existing data rather than widening a table, and unlike the ALTERs it can succeed while doing
-- nothing at all. Verify the row count it reports rather than assuming (expected: 3).

-- AlterTable
ALTER TABLE "public"."Page" ADD COLUMN "description" TEXT;
ALTER TABLE "public"."Page" ADD COLUMN "metaDescription" TEXT;

-- AlterTable
ALTER TABLE "public"."Domain" ADD COLUMN "description" TEXT;
ALTER TABLE "public"."Domain" ADD COLUMN "metaDescription" TEXT;

-- ---------------------------------------------------------------------------
-- Retire Roadmap.description by copying it, not by moving it.
-- ---------------------------------------------------------------------------
--
-- `Roadmap.description` was this same feature built for one page type: an author-written one-line
-- intro, rendered under the heading and feeding the meta description. Roadmaps are Pages, so
-- keeping both columns would mean two fields for one concept — the author edits one box and the
-- page shows the other, with nothing erroring.
--
-- ⚠️ THE SOURCE COLUMN IS DELIBERATELY *NOT* DROPPED HERE. That is Phase O-6, a separate migration
-- run only after this copy has been confirmed on both Neon branches. Dropping it in the same
-- statement that creates the destination would delete the only copy of the data in the same breath
-- as writing it — and if this `UPDATE` matched zero rows, there would be nothing to recover from.
--
-- ⚠️ COPIED INTO `description`, NOT `metaDescription`. Its live role is an on-page intro line. Two
-- of the three existing values are under the 40-character floor in `buildPageDescription` and so
-- already fall through to the generated template; their search snippets do not change.
--
-- `btrim` and the `<> ''` guard because a whitespace-only value is not a description — without
-- them a page would get an empty non-null string, which renders as an empty paragraph rather than
-- as nothing at all.
UPDATE "public"."Page" p
SET    "description" = btrim(r."description")
FROM   "public"."Roadmap" r
WHERE  r."pageId" = p."id"
  AND  r."description" IS NOT NULL
  AND  btrim(r."description") <> '';
