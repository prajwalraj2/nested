import { SITE_NAME, SITE_URL, stripEmoji } from './seo'
import type { BreadcrumbItem } from '@/services/types'

/**
 * schema.org structured data (JSON-LD) builders.
 * ============================================================================
 *
 * WHAT JSON-LD IS
 * ---------------
 * A `<script type="application/ld+json">` block containing a machine-readable
 * description of what a page MEANS, in a vocabulary search engines understand
 * (schema.org). Invisible to visitors; it exists purely for crawlers.
 *
 * It is needed because HTML only describes PRESENTATION. `<h1>` says "this is a big
 * heading" — there is no way in HTML to say "this page sits inside Graphic Designing,
 * which sits inside Domains". The sidebar and breadcrumb convey that visually to a
 * human; a crawler sees only divs and anchors.
 *
 * WHAT IT BUYS US
 * ---------------
 * Google turns certain schema types into **rich results**. `BreadcrumbList` replaces
 * the URL line in a search listing with a clickable hierarchy:
 *
 *   before:  https://atno.io/domain/webdev/withcode/definingservices/portfoliowebsite
 *   after:   ATNO › Domains › Web Development › withcode › Portfolio Website
 *
 * This site is up to four levels deep across ~1,198 URLs, so raw URLs are genuinely
 * unhelpful in a result. That is exactly the case breadcrumb markup exists for.
 *
 * ⚠️ HONEST LIMITS — do not oversell this:
 *   - **It is not a ranking factor.** Google has said structured data does not boost
 *     rankings. It changes how a result LOOKS, which affects click-through rate.
 *   - Valid markup makes you *eligible* for a rich result, never guaranteed. Google
 *     decides.
 *   - It cannot fix thin content. Most pages here are lists of outbound links; JSON-LD
 *     makes a well-indexed page present better, it does not make a thin page rank.
 */

/**
 * Escape a string for safe embedding inside a `<script>` block.
 *
 * ⚠️ THIS IS A REAL XSS DEFENCE, NOT CEREMONY.
 *
 * The JSON is injected with `dangerouslySetInnerHTML` (see src/components/JsonLd.tsx
 * for why that is unavoidable). Inside a `<script>` element the HTML parser is looking
 * for the literal sequence `</script`, and it does NOT care that the sequence sits
 * inside a JSON string. So a page title containing:
 *
 *     </script><script>alert(document.cookie)</script>
 *
 * would close our block early and open an attacker-controlled one. `JSON.stringify`
 * does not help — it escapes quotes and backslashes, not `<` or `/`.
 *
 * Page and domain titles are admin-authored, and this escape is the only thing standing
 * between a title and script execution.
 *
 * ⚠️ THIS NOTE USED TO ADD "and #2 already sanitises rich-text HTML" as reassurance. It no
 * longer does — sanitisation was removed on 15 Aug 2026 (#35). That does not weaken this
 * function, which never depended on it: titles are plain `String` columns and were always
 * outside the sanitiser's reach. But the surrounding safety net is thinner than the old
 * wording implied, so this escape now matters more, not less.
 *
 * Escaping `<` and `>` to their unicode form keeps the JSON valid and semantically
 * identical (JSON parsers decode `\u003c` back to `<`), while making the byte sequence
 * `</script` impossible to produce.
 */
function escapeForScriptTag(value: string): string {
  return value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
}

/** Clean a database title for structured data: strip emoji, escape, collapse space. */
function cleanLabel(label: string): string {
  // Emoji are stripped for the same reason as in page titles (src/lib/seo.ts): Google
  // discards them from results anyway, and decorative characters in structured data
  // read as low-quality markup.
  return escapeForScriptTag(stripEmoji(label))
}

/** Turn a site-relative path into the absolute URL schema.org requires. */
function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${SITE_URL}${path}`
}

/**
 * Build a `BreadcrumbList` from the navigation service's breadcrumb items.
 *
 * @returns the JSON-LD object, or `null` when there is nothing worth emitting.
 *
 * ⚠️ RETURNS NULL BELOW TWO ITEMS. A single-item "trail" is not a hierarchy; Google
 * ignores it, and emitting one just adds bytes to every page. `null` lets the caller
 * render nothing at all rather than an empty script tag.
 *
 * ⚠️ THE LAST ITEM DELIBERATELY OMITS `item` (its URL). That is what schema.org
 * prescribes — the final crumb is the page you are already on, so a self-link is
 * redundant. Google's own examples do the same.
 *
 * ⚠️ `position` is 1-BASED, not 0-based. Getting this wrong is a silent failure: the
 * markup validates but Google discards the trail.
 *
 * The label correctness here depends on the parent-chain resolution in
 * `buildBreadcrumbData` (see #7). Before that fix, labels were matched by slug alone
 * and 20 of 1,163 paths resolved to a DIFFERENT page's title — `websitebuilders`
 * showed "AI Website Builders" when the page was "Website Builders (CMS)". Feeding
 * that to a search engine would have been worse than emitting nothing, which is why
 * the fix came first.
 */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): object | null {
  if (items.length < 2) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      const isLast = index === items.length - 1

      return {
        '@type': 'ListItem',
        position: index + 1,
        name: cleanLabel(item.label),
        // Omitted on the final crumb — see the note above.
        ...(isLast ? {} : { item: absoluteUrl(item.url) }),
      }
    }),
  }
}

/**
 * Build an `Organization` entity for the site.
 *
 * Far more modest than the breadcrumb: it tells Google that "ATNO" is a named thing
 * with a canonical URL and a logo, rather than leaving it to infer a brand from page
 * text. It can feed a knowledge panel and helps disambiguate the name in results.
 *
 * Static — no database access — so it costs nothing to render.
 *
 * ⚠️ Emitted only on `/domain`. An `Organization` block belongs on the site's primary
 * entry point, not repeated on all 1,198 pages: duplicating an identical entity
 * everywhere adds bytes and gives Google conflicting signals about which URL is the
 * organisation's home.
 */
export function buildOrganizationJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    // Reuses the Open Graph card. A dedicated square logo would be marginally better
    // for knowledge-panel display, but pointing at an image that already exists and is
    // known-good beats referencing one that may not.
    logo: `${SITE_URL}/og-image.png`,
    description:
      'Curated tools, resources and channels across design, development, AI, ecommerce and more.',
  }
}

/**
 * `Article` structured data for one blog post (M-9).
 *
 * ⚠️ EMITTED ONLY ON A POST'S OWN PAGE, never on the listing. The listing is a collection, not an
 * article — describing it as one is the kind of mismatch between markup and content that Google
 * treats as a quality signal against the site rather than a harmless mistake.
 *
 * ⚠️ FIELDS ARE OMITTED WHEN ABSENT, NOT FILLED WITH PLACEHOLDERS. A post with no cover simply has
 * no `image`; inventing one would put a claim in machine-readable markup that the page does not
 * support, which is worse than saying nothing.
 */
export function buildArticleJsonLd(post: {
  title: string
  slug: string
  excerpt: string | null
  coverUrl: string | null
  author: string
  publishedAt: Date
  updatedAt: Date
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    /*
      ⚠️ ABSOLUTE, and `mainEntityOfPage` rather than a bare `url`. Production is served on two
      hostnames (see `lib/seo.ts`), so a relative value would resolve differently depending on
      which one a crawler arrived at — the same reason a canonical is pinned there.
    */
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blogs/${post.slug}` },
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(post.coverUrl ? { image: post.coverUrl } : {}),
    author: { '@type': 'Person', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.png` },
    },
    /*
      ⚠️ ISO STRINGS, NOT `Date` OBJECTS. `JSON.stringify` would serialise a Date correctly here by
      accident, but being explicit means the shape does not change if this object is ever built
      somewhere that stringifies differently.
    */
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
  }
}
