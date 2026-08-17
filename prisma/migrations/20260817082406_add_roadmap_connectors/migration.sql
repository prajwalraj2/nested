-- AlterTable
ALTER TABLE "public"."RoadmapNode" ADD COLUMN     "branchFrom" TEXT NOT NULL DEFAULT 'bottom',
ADD COLUMN     "connector" TEXT NOT NULL DEFAULT 'branch';
