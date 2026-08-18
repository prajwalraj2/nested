// src/app/admin/submissions/page.tsx

import SubmissionsQueue from '@/components/admin/submissions/SubmissionsQueue';

/**
 * `/admin/submissions` (M-6).
 *
 * ⚠️ A THIN WRAPPER ON PURPOSE. All the rendering lives in `components/admin/submissions/`, which
 * is one of the directories `eslint.config.mjs` bans `dangerouslySetInnerHTML` in. A component
 * that displayed submitted values from here instead would sit outside that guard.
 */
export default function AdminSubmissionsPage() {
  return <SubmissionsQueue />;
}
