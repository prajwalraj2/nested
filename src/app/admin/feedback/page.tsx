// src/app/admin/feedback/page.tsx

import FeedbackQueue from '@/components/admin/feedback/FeedbackQueue';

/**
 * `/admin/feedback` (M-5).
 *
 * ⚠️ THE THIN WRAPPER IS THE POINT. All the rendering lives in `components/admin/feedback/`, which
 * is one of the directories the `dangerouslySetInnerHTML` ban in `eslint.config.mjs` covers. A
 * component that displayed submitted values from here instead would sit outside that guard.
 */
export default function AdminFeedbackPage() {
  return <FeedbackQueue />;
}
