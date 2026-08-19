// src/app/admin/changelog/page.tsx

import ChangelogEditor from '@/components/admin/changelog/ChangelogEditor';

/**
 * `/admin/changelog` (M-7).
 *
 * ⚠️ Unlike `/admin/feedback` and `/admin/submissions`, this directory is NOT covered by the
 * `dangerouslySetInnerHTML` ban — the rows here are written by the admin, not by strangers. See
 * the note at the top of `ChangelogEditor`.
 */
export default function AdminChangelogPage() {
  return <ChangelogEditor />;
}
