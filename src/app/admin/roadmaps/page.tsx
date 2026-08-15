// src/app/admin/roadmaps/page.tsx

import { AdminPageHeader } from '@/components/admin/layout/AdminPageHeader';
import { RoadmapsManager } from '@/components/admin/roadmaps/RoadmapsManager';

/**
 * Roadmap Management (L-3).
 *
 * ⚠️ A thin shell, matching `/admin/images` — the data is fetched client-side because the
 * screen mutates (creating a roadmap changes a row in place) and the list must reflect that
 * immediately. Server-rendering the first paint buys nothing a visitor sees: this is behind
 * admin auth and never indexed, and it would leave two code paths for the same list.
 *
 * ⚠️ `force-dynamic`: an admin who has just created a roadmap and is shown the previous list
 * would reasonably conclude it failed, and click again.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Roadmaps · ATNO Admin',
};

export default function AdminRoadmapsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Roadmaps"
        description="Step-by-step learning paths. Each one lives on a page whose content type is Roadmap."
      />
      <RoadmapsManager />
    </div>
  );
}
