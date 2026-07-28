import { NotFoundContent } from '@/components/NotFoundContent';

/**
 * 404 for anything under `/domain`.
 * ============================================================================
 *
 * This exists so a domain-level 404 keeps its NAVIGATION. Next.js wraps each
 * `not-found.tsx` in the layouts above it, so this one renders inside
 * `src/app/domain/layout.tsx` and therefore still has the sidebar and breadcrumb —
 * whereas the root `not-found.tsx` would have shown a bare page with no way to get
 * anywhere except the one link.
 *
 * That is the common case, not an edge case. `src/app/domain/[...slug]/page.tsx` calls
 * `notFound()` in four places:
 *
 *   - the domain slug does not exist
 *   - the domain is not visible to the visitor's country
 *   - `PageService.getByPath` finds no page for the remaining segments
 *   - a `direct` domain has no `__main__` page
 *
 * ⚠️ No `metadata` export here on purpose — it would be silently ignored. Verified by
 * reading the rendered `<head>` of both variants:
 *
 *   /nonexistent-page        ->  <title>Page not found · ATNO</title>   (root file's metadata)
 *   /domain/does-not-exist   ->  <title>ATNO - Domain Explorer</title>  (root LAYOUT default)
 *
 * So this page inherits the layout's default title rather than "Page not found".
 * Accepted rather than worked around: the title of a page that returns HTTP 404 has no
 * SEO weight (Google does not index 404s) and the cost is a slightly generic browser
 * tab. Adding a `metadata` export here to "fix" it would look like it worked and
 * change nothing — worse than leaving it.
 *
 * `robots: noindex` IS present on this page, but it comes from `generateMetadata` in
 * `[...slug]/page.tsx`, which returns it before calling `notFound()` — not from here.
 *
 * ⚠️ WORTH REVISITING once geo tagging begins (see #8-DR). Reasons 2 and 3 above mean
 * an out-of-region visitor clicking a shared link lands here — the page genuinely
 * exists, just not for them. "This page doesn't exist" is then slightly misleading. A
 * distinct message would be better, but it needs the country context passed down, and
 * today no content is geo-restricted so the case cannot occur.
 */
export default function DomainNotFound() {
  return <NotFoundContent />;
}
