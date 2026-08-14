/*
  Warnings:

  - You are about to drop the column `characterCount` on the `RichTextContent` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `RichTextContent` table. All the data in the column will be lost.
  - You are about to drop the column `lastEditedBy` on the `RichTextContent` table. All the data in the column will be lost.
  - You are about to drop the column `settings` on the `RichTextContent` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `RichTextContent` table. All the data in the column will be lost.
  - Made the column `htmlContent` on table `RichTextContent` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."RichTextContent" DROP COLUMN "characterCount",
DROP COLUMN "content",
DROP COLUMN "lastEditedBy",
DROP COLUMN "settings",
DROP COLUMN "version",
ALTER COLUMN "htmlContent" SET NOT NULL;
