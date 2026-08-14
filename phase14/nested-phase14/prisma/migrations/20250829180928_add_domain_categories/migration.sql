-- AlterTable
ALTER TABLE "public"."Domain" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orderInCategory" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."DomainCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "columnPosition" INTEGER NOT NULL DEFAULT 1,
    "categoryOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainCategory_slug_key" ON "public"."DomainCategory"("slug");

-- CreateIndex
CREATE INDEX "DomainCategory_columnPosition_categoryOrder_idx" ON "public"."DomainCategory"("columnPosition", "categoryOrder");

-- CreateIndex
CREATE INDEX "Domain_categoryId_orderInCategory_idx" ON "public"."Domain"("categoryId", "orderInCategory");

-- AddForeignKey
ALTER TABLE "public"."Domain" ADD CONSTRAINT "Domain_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."DomainCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
