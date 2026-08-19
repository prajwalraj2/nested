-- M-7: the public product board.
--
-- Purely additive: one new table, nothing existing altered.

-- CreateTable
CREATE TABLE "public"."ChangelogEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangelogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangelogEntry_status_order_idx" ON "public"."ChangelogEntry"("status", "order");
