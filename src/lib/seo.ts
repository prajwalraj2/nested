/**
 * Shared SEO helpers
 * ============================================================================
 *
 * Small pure functions used by `generateMetadata` in the public pages, and later
 * by `src/app/sitemap.ts`. Kept in one place so the site name, the canonical
 * origin, and the emoji-stripping rule can't drift apart between call sites.
 */

import { ALL_COUNTRIES } from './countries'

/** Brand name, appended to every page title. */
export const SITE_NAME = 'ATNO'

/**
 * The separator between the parts of a title: `Page · Domain · ATNO`.
 *
 * ⚠️ NOT the conventional `|`. Six domain names and several page titles already
 * contain pipes as part of their actual content:
 *
 *     🌻 AI | ML | DL [ Traditional ]
 *     🥽 AR | VR | MR | XR Developer
 *     👨‍💻 Cybersecurity | Hacking
 *     Languages | Libraries | Frameworks
 *
 * With `|` as the separator, that first one renders as
 * `AI | ML | DL [ Traditional ] | ATNO` — the structural separator is
 * indistinguishable from the content, and a search result reads as noise.
 *
 * U+00B7 MIDDLE DOT appears nowhere in the current titles, is in the BMP so it
 * renders everywhere, and is visually lighter than a pipe. Verified against every
 * domain name and 500 page titles in the database.
 */
export const TITLE_SEPARATOR = ' · '

/**
 * The canonical origin. Every generated URL is absolute against this.
 *
 * ⚠️ Why hardcoded rather than read from the request: production is served on TWO
 * hostnames — `atno.io` and `nested-two.vercel.app` (both listed under Domains in
 * Vercel). If canonical URLs were derived from whichever host answered, Google
 * would see two complete copies of the site and split the ranking signals between
 * them. Pinning it here means both hostnames say "the real version is atno.io".
 */
export const SITE_URL = 'https://atno.io'

/**
 * The share image used in link previews — WhatsApp, LinkedIn, Teams, Slack, X,
 * Discord, iMessage.
 * ============================================================================
 *
 * WHY THESE EXACT DIMENSIONS: 1200 × 630 is the Open Graph recommendation
 * (1.91:1). X's `summary_large_image` card wants 2:1. They are close enough that
 * one image serves both with no meaningful cropping.
 *
 * The source is `design/logo/…/atno-icon-and-logo-blackcolor-horizontal-align-
 * transparent.png`, which is exactly 2:1 — the artwork was cropped to its ink
 * bounding box and centred on white at 62% of the card width, so the margins are
 * deliberate rather than whatever the original export happened to include.
 *
 * ⚠️ Kept at 42 KB. Preview crawlers fetch this synchronously while rendering a
 * card, and some (WhatsApp especially) give up on slow or heavy images. The
 * unresized 1774×887 original was 662 KB.
 *
 * `width`/`height` are declared because several consumers use them to reserve
 * layout space before the image has downloaded.
 */
export const OG_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — curated tools and resources, organised by domain`,
} as const

/**
 * Build a COMPLETE Open Graph object.
 * ============================================================================
 *
 * ⚠️ WHY THIS EXISTS — Next.js merges metadata **shallowly**.
 *
 * When a page defines `openGraph`, that object REPLACES the layout's `openGraph`
 * outright; the two are not merged field by field. So this looks correct and isn't:
 *
 *     // layout.tsx
 *     openGraph: { type: 'website', siteName: 'ATNO', locale: 'en_US', url: '/' }
 *
 *     // page.tsx
 *     openGraph: { title: 'Graphic Designing', description: '…', url: '/domain/…' }
 *
 *     // ACTUAL OUTPUT — type, siteName and locale are silently GONE:
 *     <meta property="og:title" content="Graphic Designing">
 *     <meta property="og:description" content="…">
 *     <meta property="og:url" content="https://atno.io/domain/…">
 *
 * Losing `og:site_name` means link previews in WhatsApp, LinkedIn and Slack stop
 * showing the "ATNO" brand line above the title. Losing `og:type` leaves consumers
 * guessing at what kind of thing the URL is.
 *
 * This was caught by reading the actual rendered `<head>`, not from the code — which
 * is the point: build the whole object every time, in one place, so a page can't
 * partially specify it and quietly drop the rest.
 */
export function buildOpenGraph(opts: {
  title: string
  description: string
  url: string
}) {
  return {
    // 'website' rather than 'article' — these are directory/listing pages, not
    // authored posts with a publish date and byline.
    type: 'website' as const,
    // The brand line shown above the title in link previews.
    siteName: SITE_NAME,
    // A language+region hint for preview renderers. All content is English;
    // geo-targeting varies WHICH items appear, never the language.
    locale: 'en_US',
    // One site-wide card for now. When per-page generated cards land
    // (`opengraph-image.tsx`), this is the single line that changes.
    images: [OG_IMAGE],
    ...opts,
  }
}

/**
 * Build a COMPLETE Twitter card object. Same shallow-merge trap as
 * `buildOpenGraph` above — always specify every field.
 *
 * `summary_large_image` is the WIDE card — the big banner above the title, as in
 * the langchain.com preview. It needs an image of at least 2:1; `OG_IMAGE` is
 * 1200×630, which qualifies.
 *
 * ⚠️ Never declare this card without a usable image. X falls back to a bare link,
 * and some clients render an empty grey box — worse than the small `summary`
 * card. If `OG_IMAGE` is ever removed, drop this back to 'summary'.
 *
 * X reads `twitter:image` first and falls back to `og:image`, so the image below
 * is strictly redundant. It is declared anyway: that fallback is one platform's
 * implementation detail, and depending on it makes the output harder to reason
 * about.
 */
export function buildTwitter(opts: { title: string; description: string }) {
  return {
    card: 'summary_large_image' as const,
    images: [OG_IMAGE.url],
    ...opts,
  }
}

/**
 * Remove emoji and other pictographic characters from a string.
 *
 * WHY: page and domain titles in the database carry emoji — `▶️ YouTube Channel`,
 * `🖌️ Graphic Designing`, `📂 Other Domains`. They look good in the UI and we keep
 * them there. But in a `<title>`:
 *   - Google strips them from search results anyway, so they buy nothing
 *   - they consume part of the ~60-character budget before Google truncates
 *   - they render inconsistently across platforms
 *
 * ⚠️ WHY EXPLICIT RANGES AND NOT `\p{Extended_Pictographic}`:
 * The property-escape version is shorter and more accurate, but it requires
 * `target: "ES2018"` or later and `tsconfig.json` is on `ES2017` — TypeScript
 * rejects it with "Unicode property value expressions are only available when
 * targeting ES2018 or later". Bumping the target is a project-wide change with
 * unrelated consequences, so we enumerate the blocks instead.
 *
 * ⚠️ The obvious naive range `\u{1F300}-\u{1FAFF}` is NOT enough. `▶️` is
 * U+25B6 + U+FE0F — U+25B6 lives in Geometric Shapes (U+25A0–U+25FF), nowhere near
 * the emoji planes. Miss that block and `▶️ YouTube Channel` becomes `▶ YouTube
 * Channel`, which is worse than leaving it alone. Each range below is there for a
 * reason:
 */
const PICTOGRAPHIC = new RegExp(
  '[' +
    '\\u200D' +              // Zero-width joiner — glues multi-part emoji together
    '\\uFE00-\\uFE0F' +      // Variation selectors — the invisible "render as emoji" flag
    '\\u20E3' +              // Combining enclosing keycap — the box around 1️⃣
    '\\u2190-\\u21FF' +      // Arrows            ← ↑ → ↔ ⇒
    '\\u2300-\\u23FF' +      // Misc technical    ⌛ ⏰ ⏸ ⏳
    '\\u2460-\\u24FF' +      // Enclosed alphanumerics  ① Ⓜ
    '\\u25A0-\\u25FF' +      // Geometric shapes  ▶ ◀ ■ ● — the ▶️ case above
    '\\u2600-\\u26FF' +      // Misc symbols      ☀ ★ ⚡ ⚽
    '\\u2700-\\u27BF' +      // Dingbats          ✂ ✅ ✨ ❤
    '\\u2B00-\\u2BFF' +      // Misc symbols & arrows  ⬆ ⭐ ⬛
    '\\uD800-\\uDFFF' +      // Surrogates — see the note below
  ']',
  'g'
)

/**
 * ⚠️ Note on `\uD800-\uDFFF`: everything above U+FFFF (all the "real" emoji —
 * 😀 🎨 🚀 — which live in U+1F300–U+1FAFF) is stored in JavaScript as a SURROGATE
 * PAIR: two 16-bit code units in the D800–DFFF range. Because we can't use the `u`
 * regex flag together with an ES2017 target cleanly, we match those code units
 * directly. That is a blunt instrument — it removes ALL astral-plane characters, not
 * just emoji — but every title in this database is English plus emoji, so nothing
 * else is at risk. If non-BMP scripts are ever used in titles, revisit this.
 */

/**
 * Clean a database title for use in metadata.
 *
 * @example stripEmoji('▶️ YouTube Channel')   → 'YouTube Channel'
 * @example stripEmoji('🖌️ Graphic Designing') → 'Graphic Designing'
 * @example stripEmoji('Web Development')      → 'Web Development'  (unchanged)
 *
 * One deliberate non-removal: a KEYCAP sequence like `1️⃣` is the plain digit `1`
 * followed by U+FE0F and U+20E3. We strip the two invisible modifiers and keep the
 * digit, so `Step 1️⃣ Setup` → `Step 1 Setup`, not `Step Setup`. The digit carries
 * meaning; dropping it would silently corrupt the title.
 */
export function stripEmoji(input: string): string {
  return input
    .replace(PICTOGRAPHIC, '')
    // Removing an emoji leaves a double space behind ("A 🎨 B" → "A  B"), so
    // collapse any run of whitespace down to one space.
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Cut a string to `max` characters without slicing a word in half.
 *
 * Meta descriptions are truncated by Google at roughly 155–160 characters. Cutting
 * it ourselves at a word boundary reads better than letting Google chop mid-word.
 *
 * @example truncate('one two three', 9) → 'one two…'
 */
export function truncate(input: string, max = 155): string {
  const text = input.trim()
  if (text.length <= max) return text

  // Reserve one character for the ellipsis, then walk back to the last space so we
  // don't end mid-word.
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')

  // If there is no space at all (one enormous word), just hard-cut it.
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}

/**
 * Extract readable plain text from a stored HTML blob.
 *
 * Used to build a genuine meta description for `rich_text` pages from their actual
 * content, instead of a generic template. Real prose in the description makes a much
 * better search snippet.
 *
 * ⚠️ Order matters here. `<script>` and `<style>` elements are removed WITH THEIR
 * CONTENTS first. If we only stripped tags, `<script>alert(1)</script>` would leave
 * the literal text `alert(1)` sitting in the description. (It could not *execute* —
 * Next.js escapes metadata attribute values — it would just be nonsense text.) This
 * matters because rich-text HTML is not yet sanitised on write; that's finding #2.
 */
export function htmlToText(html: string): string {
  return html
    // 1. Drop script/style blocks entirely, contents included.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // 2. Turn block-level boundaries into spaces so "</p><p>" doesn't fuse two
    //    sentences into "endStart".
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    // 3. Remove every remaining tag.
    .replace(/<[^>]+>/g, '')
    // 4. Decode the handful of entities that actually show up in practice.
    //    `&amp;` MUST be last, or "&amp;lt;" would double-decode into "<".
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    // 5. Collapse the whitespace all of the above just introduced.
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Is this content indexable by search engines?
 *
 * Only content targeted at `ALL` should be indexed. See finding #15.4 for the full
 * reasoning, but in short:
 *
 *   1. Googlebot crawls predominantly from US IP addresses and sends no cookies, so
 *      the middleware assigns it `DEFAULT_COUNTRY` = 'US'.
 *   2. A page targeted `["US"]` is therefore VISIBLE to Googlebot, and gets indexed.
 *   3. An Indian visitor then finds it in Google, clicks, and `getByPath` filters it
 *      out → `notFound()` → a 404.
 *   4. Google sees an indexed URL that 404s for most visitors → **soft 404**, which
 *      is a quality penalty.
 *
 * Marking such pages `noindex` breaks that chain. Pages targeted `["IN"]` are safe
 * without this — Googlebot resolves to 'US', gets a 404 during the crawl, and never
 * indexes them in the first place. It is specifically the US-targeted ones that leak.
 *
 * Both arguments must be `ALL`: a globally-targeted page inside an India-only domain
 * is still unreachable for everyone else, because the domain check in
 * `src/app/domain/[...slug]/page.tsx` runs first and 404s.
 */
export function isGloballyIndexable(
  domainTargetCountries: string[] | undefined | null,
  pageTargetCountries?: string[] | undefined | null
): boolean {
  const isAll = (list: string[] | undefined | null) =>
    // An empty/absent list means "no restriction" — matches isContentVisibleToUser()
    // in src/lib/server-country.ts, which treats it the same way.
    !list || list.length === 0 || list.includes(ALL_COUNTRIES)

  return isAll(domainTargetCountries) && isAll(pageTargetCountries)
}
