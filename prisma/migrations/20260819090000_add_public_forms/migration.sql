-- M-4 / M-5: the first public write surface on this site.
--
-- Purely additive: two new tables, no column added to or removed from anything existing, so this
-- cannot disturb the admin, the domain tree or the tables feature.

-- CreateTable
CREATE TABLE "public"."RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."Feedback" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "pageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "public"."RateLimit"("windowStart");

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "public"."Feedback"("status", "createdAt");
