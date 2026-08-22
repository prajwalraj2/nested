-- N-5: when a person last reviewed a domain's pages.
--
-- Additive and nullable: every existing row becomes NULL, which means "never reviewed" and renders
-- no badge at all. So applying this ahead of the code changes nothing that is visible.

-- AlterTable
ALTER TABLE "public"."Domain" ADD COLUMN "reviewedAt" TIMESTAMP(3);
