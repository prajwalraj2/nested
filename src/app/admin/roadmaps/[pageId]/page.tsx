// src/app/admin/roadmaps/[pageId]/page.tsx

import { AdminPageHeader } from '@/components/admin/layout/AdminPageHeader';
import { RoadmapEditor } from '@/components/admin/roadmaps/RoadmapEditor';

/**
 * The roadmap tree editor (L-4).
 *
 * ⚠️ Keyed by PAGE id, matching `/api/admin/roadmaps/[pageId]` and the link from the list
 * screen. A roadmap is 1:1 with a page and every route in comes from a page, so keying on the
 * roadmap's own id would force a lookup before anything could navigate here.
 *
 * `force-dynamic` for the same reason as the list: this screen mutates constantly, and an admin
 * shown a cached tree after a move would reasonably conclude the move failed.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Edit roadmap · ATNO Admin',
};

export default async function AdminRoadmapEditorPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Edit roadmap"
        description="Build the topic tree. Topics with no content render as labels rather than links."
      />
      <RoadmapEditor pageId={pageId} />
    </div>
  );
}
