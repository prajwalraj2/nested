// src/app/admin/careers/page.tsx

import CareersManager from '@/components/admin/careers/CareersManager';

/**
 * `/admin/careers` (M-8) — roles and the applications to them.
 *
 * ⚠️ `components/admin/careers/` IS covered by the `dangerouslySetInnerHTML` ban in
 * `eslint.config.mjs` — applicant names and email addresses are written by strangers.
 */
export default function AdminCareersPage() {
  return <CareersManager />;
}
