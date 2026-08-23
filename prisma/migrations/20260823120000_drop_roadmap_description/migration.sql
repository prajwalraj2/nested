-- #38 / Phase O-5: drop Roadmap.description.
--
-- Superseded by Page.description, which does the same job for every content type rather than for
-- roadmaps alone. See NEW-IMPROVEMENTS-4.md #38 decision (f).
--
-- ⚠️ DESTRUCTIVE, AND SAFE FOR TWO SPECIFIC REASONS — not because dropping a column is routine:
--
--   1. Migration 20260822160000 already COPIED every non-empty value into "Page"."description",
--      and that copy was verified row by row (3 of 3 matched, development branch).
--   2. The column was then emptied and every Roadmap row deleted, by hand, on BOTH branches. So
--      at the time of writing there is no data in this column anywhere.
--
-- The original plan held this drop back as a separate step (O-6) precisely so the source would
-- still exist if the copy had gone wrong. That protection is no longer needed, which is why O-6
-- was merged into O-5 rather than skipped.

ALTER TABLE "public"."Roadmap" DROP COLUMN "description";
