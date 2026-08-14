-- DropForeignKey
ALTER TABLE "public"."ContentBlock" DROP CONSTRAINT "ContentBlock_pageId_fkey";

-- AlterTable
ALTER TABLE "public"."ContentBlock" ADD COLUMN     "columnPosition" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "public"."ContentBlock" ADD CONSTRAINT "ContentBlock_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
