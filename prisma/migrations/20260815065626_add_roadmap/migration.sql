-- CreateTable
CREATE TABLE "public"."Roadmap" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Roadmap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoadmapNode" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "htmlContent" TEXT,
    "plainText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Roadmap_pageId_key" ON "public"."Roadmap"("pageId");

-- CreateIndex
CREATE INDEX "RoadmapNode_roadmapId_parentId_order_idx" ON "public"."RoadmapNode"("roadmapId", "parentId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapNode_roadmapId_slug_key" ON "public"."RoadmapNode"("roadmapId", "slug");

-- AddForeignKey
ALTER TABLE "public"."Roadmap" ADD CONSTRAINT "Roadmap_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoadmapNode" ADD CONSTRAINT "RoadmapNode_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "public"."Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoadmapNode" ADD CONSTRAINT "RoadmapNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."RoadmapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
