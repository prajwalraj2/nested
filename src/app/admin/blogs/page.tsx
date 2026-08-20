// src/app/admin/blogs/page.tsx

import BlogManager from '@/components/admin/blogs/BlogManager';

/**
 * `/admin/blogs` (M-9).
 *
 * ⚠️ `components/admin/blogs/` is deliberately OUTSIDE the `dangerouslySetInnerHTML` ban — posts
 * are admin-authored and the editor's preview needs raw HTML. Same call as `admin/changelog`, and
 * the opposite of `admin/feedback`, `admin/submissions` and `admin/careers`.
 */
export default function AdminBlogsPage() {
  return <BlogManager />;
}
