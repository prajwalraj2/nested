// src/lib/blog-types.ts

/**
 * Blog vocabulary and the two rules every public read must obey (M-9).
 * ============================================================================
 *
 * ⚠️ Same reason as the other four `*-types.ts` files: a Next route handler may only export the
 * HTTP verbs, so anything shared between a route and a component cannot live in the route.
 */

export const BLOG_CATEGORIES = [
  { value: 'guides', label: 'Guides' },
  { value: 'tools', label: 'Tools' },
  { value: 'careers', label: 'Careers' },
  { value: 'behind-the-scenes', label: 'Behind the scenes' },
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number]['value'];

export const BLOG_CATEGORY_VALUES = BLOG_CATEGORIES.map((c) => c.value) as unknown as [
  BlogCategory,
  ...BlogCategory[],
];

export function blogCategoryLabel(value: string): string {
  return BLOG_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** How many posts one page of the listing shows. */
export const POSTS_PER_PAGE = 10;

/**
 * ⚠️ THE ONLY CORRECT `where` FOR A PUBLIC BLOG READ. Use it everywhere — the listing, the post
 * page, the sitemap, `generateMetadata`.
 *
 * `publishedAt` is a DATE, not a status. `null` means draft; a date in the FUTURE means scheduled.
 * Both must be invisible, and `{ not: null }` alone would leak every scheduled post the moment it
 * was saved — which is the whole point of scheduling by date.
 *
 * ⚠️ IT MUST BE A FUNCTION, NOT A CONSTANT. A module-level `{ lte: new Date() }` is evaluated once
 * when the module loads, so a long-lived serverless instance would keep comparing against the time
 * it booted and a post would stay hidden after its moment passed. Called per request, it is right
 * every time.
 */
export function publishedFilter() {
  return { publishedAt: { not: null, lte: new Date() } };
}

/**
 * Turn a title into a URL slug.
 *
 * ⚠️ A SUGGESTION FOR THE ADMIN FORM, NOT A GUARANTEE OF UNIQUENESS. `BlogPost.slug` is `@unique`
 * in the database and the API returns a 409 on collision — this only saves typing. Deriving a slug
 * and then trusting it to be free is how two posts race to the same URL.
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    /*
      ⚠️ Strips accents so "Café" becomes "cafe" rather than "caf". `normalize('NFD')` splits an
      accented character into its base letter plus a combining mark, and the range below removes
      only the marks.
    */
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Rough reading time, for the listing. ~200 words a minute, floored at one. */
export function readingMinutes(plainText: string | null | undefined): number {
  if (!plainText) return 1;
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Is this a cover URL the site can actually render?
 *
 * ⚠️ IT MUST MIRROR `images.remotePatterns` IN `next.config.ts` EXACTLY. `next/image` THROWS on an
 * unconfigured host — and because the cover is rendered inside the listing, that throw takes down
 * the WHOLE `/blogs` page with a 500, not just one image. This was hit for real: the first cover
 * ever uploaded 500'd the listing until the host was allowlisted.
 *
 * Checking here means an unrenderable cover can never be stored in the first place, so the page
 * cannot be broken by data. ⚠️ Change one of these two rules and you must change the other.
 *
 * ⚠️ `new URL()` RATHER THAN A STRING TEST. `startsWith('https://')` plus an `endsWith` on the host
 * is defeated by `https://evil.com/?x=.public.blob.vercel-storage.com` — parsing asks the question
 * that actually matters, which is what the HOSTNAME is.
 */
export function isSupportedCoverUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}
