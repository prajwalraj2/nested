-- Add `updatedAt` to Domain and Page.
--
-- ============================================================================
-- WHY
-- ============================================================================
-- `src/app/sitemap.ts` could not emit a `<lastmod>` for any URL, because neither
-- table had an "when did this last change" column — only `createdAt`.
--
-- Using `createdAt` as `lastModified` would assert "this page has not changed
-- since it was created", which is false for every page that has ever been edited.
-- That matters more than it sounds: Google's documented behaviour is to ignore
-- `lastmod` across the ENTIRE sitemap once it decides the values are unreliable.
-- A wrong date is strictly worse than no date, so the field was omitted until
-- this column existed.
--
-- ============================================================================
-- THE FIRST TWO STATEMENTS ARE PRISMA'S, VERBATIM
-- ============================================================================
-- Generated with:
--   npx prisma migrate diff --from-migrations prisma/migrations \
--     --to-schema-datamodel prisma/schema.prisma \
--     --shadow-database-url <empty db> --script
--
-- Not hand-written, so the column definition cannot drift from what
-- `schema.prisma` expects. `@updatedAt @default(now())` produces
-- `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`.

-- AlterTable
ALTER TABLE "public"."Domain" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."Page" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- THE BACKFILL BELOW IS HAND-ADDED, AND IS THE WHOLE POINT
-- ============================================================================
-- `ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP` fills EXISTING rows with the moment
-- the migration ran. On this database that is 34 domains and 1195 pages all
-- claiming they were modified at the same instant — which would tell Google the
-- entire site changed at once, the exact unreliability that made us omit
-- `lastmod` in the first place. Shipping that would have defeated the migration.
--
-- For a row that has never been edited, its creation time IS its last-modified
-- time. So copy `createdAt` across. Honest, and it gives the sitemap a spread of
-- real dates from Sep 2025 to Mar 2026 rather than one artificial spike.
--
-- The column DEFAULT stays CURRENT_TIMESTAMP — correct for rows inserted from now
-- on, and a safety net for any INSERT that does not go through Prisma Client
-- (raw SQL, seed scripts). Prisma Client itself sets the value on every update
-- because of `@updatedAt`.
--
-- On a genuinely fresh database these two UPDATEs match zero rows and are a no-op,
-- so the migration is correct in both directions.

-- Backfill: an unedited row was last changed when it was created.
UPDATE "public"."Domain" SET "updatedAt" = "createdAt";
UPDATE "public"."Page"   SET "updatedAt" = "createdAt";
