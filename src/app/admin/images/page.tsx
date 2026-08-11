// src/app/admin/images/page.tsx

import { AdminPageHeader } from '@/components/admin/layout/AdminPageHeader';
import { ImagesManager } from '@/components/admin/images/ImagesManager';

/**
 * Image Management (K-5b).
 *
 * ⚠️ Deliberately a thin shell. The data is fetched client-side by `ImagesManager` because
 * the screen mutates constantly — upload, rename, replace, delete — and every one of those
 * needs the list to refresh. Server-rendering the first paint would buy nothing that a
 * visitor sees (this is behind admin auth, never indexed) and would leave two code paths for
 * the same list.
 *
 * ⚠️ `force-dynamic`: the list must never come from a cache. An admin who has just uploaded
 * something and sees the previous list would reasonably conclude the upload failed.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Images · ATNO Admin',
};

export default function AdminImagesPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Images"
        description="Pictures used beside table rows. Uploads are resized to 64px WebP automatically."
      />
      <ImagesManager />
    </div>
  );
}
