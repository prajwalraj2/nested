-- M-6: public tool / domain-request submissions.
--
-- Purely additive: one new table. Nothing existing gains, loses or changes a column, so the
-- currently-deployed code cannot be affected by applying this ahead of the code that reads it.

-- CreateTable
CREATE TABLE "public"."Submission" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "domainId" TEXT,
    "domainName" TEXT,
    "pageId" TEXT,
    "pageName" TEXT,
    "productName" TEXT NOT NULL,
    "productUrl" TEXT,
    "description" TEXT NOT NULL,
    "submitterName" TEXT NOT NULL,
    "submitterEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Submission_status_createdAt_idx" ON "public"."Submission"("status", "createdAt");
