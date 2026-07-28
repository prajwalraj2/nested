import DOMPurify from 'isomorphic-dompurify'

/**
 * HTML sanitisation for admin-authored rich text.
 * ============================================================================
 *
 * WHAT THIS PROTECTS AGAINST
 * --------------------------
 * `PUT /api/admin/rich-text/[pageId]` accepts a raw `htmlContent` string and stores
 * it verbatim. `src/components/domain/RichTextLayout.tsx:45` then renders it to every
 * public visitor with `dangerouslySetInnerHTML`. So whatever is stored executes in
 * every visitor's browser, on the same origin as the admin panel.
 *
 * Finding #1 already closed the worst version of this — the write endpoint used to be
 * completely unauthenticated, so any stranger could plant a `<script>` tag. What is
 * left is a smaller but real risk: a compromised admin session, a careless paste from
 * an untrusted source, or a malicious browser extension injecting into the editor.
 * This bounds the damage those can do.
 *
 * ⚠️ SANITISE ON WRITE, NEVER ON READ.
 * Read paths are cached (`unstable_cache`, CDN, and now ISR). One bad write that is
 * only cleaned at render time would be re-rendered from cache indefinitely, and every
 * cache layer would have to be trusted to call the sanitiser. Cleaning once at the
 * boundary means the database only ever holds safe HTML.
 *
 * ============================================================================
 * THE ALLOW-LIST IS DERIVED FROM THE ACTUAL CONTENT, NOT GUESSED
 * ============================================================================
 * A generic allow-list would have silently destroyed real formatting the moment a page
 * was re-saved. All 415 existing rich-text rows (3.4 MB of HTML) were scanned first.
 * What they actually use:
 *
 *   tags (21):   li 17595   ul 4603   strong 1993   h5 1838   p 1617   div 1500
 *                hr 1418    h4 1366   a 590         ol 183    span 168
 *                details 52 summary 52  h3 37       h6 20
 *                td 18      tr 9      th 9          table 3   thead 3   tbody 3
 *
 *   attributes:  style 28608   href 589   target 541   class 44
 *                onmouseover 199   onmouseout 199        <- stripped, see below
 *
 * Two findings from that scan changed this file:
 *
 *   1. `details` and `summary` are used 52 times each — collapsible sections. A
 *      standard allow-list omits them, which would have collapsed 52 working
 *      disclosure widgets into loose text.
 *
 *   2. `style` appears 28,608 times across 407 of the 415 rows (98%). Inline styles
 *      are the PRIMARY formatting mechanism here, not classes. Dropping `style` would
 *      have flattened essentially every rich-text page on the site. The top properties
 *      are margin-bottom, text-align, margin-top, padding-left, list-style-type,
 *      font-size, border-color and color — all ordinary layout and typography.
 *
 * DOMPurify does not blindly trust `style`: it parses the declaration list and removes
 * dangerous constructs such as `expression()` and `url(javascript:…)`, keeping the
 * plain properties. So allowing it is not the same as allowing arbitrary CSS.
 */

/**
 * Tags permitted in stored rich text.
 *
 * Everything the existing content uses, plus safe formatting an editor would
 * reasonably reach for next (`br`, `em`, `code`, `blockquote`, definition lists…).
 * Being slightly generous here is the safe direction: an unexpected-but-harmless tag
 * being stripped is a silent content bug, whereas these tags cannot execute anything.
 */
const ALLOWED_TAGS = [
  /**
   * ⚠️ `#text` IS LOAD-BEARING. DO NOT REMOVE IT.
   *
   * DOMPurify treats text nodes as a pseudo-tag called `#text`. Omit it from a custom
   * ALLOWED_TAGS and text nodes count as disallowed elements — which combined with
   * `KEEP_CONTENT: false` below **destroys every piece of visible text on the page**.
   *
   * Verified in isolation, because it is invisible unless both conditions hold:
   *
   *   no #text, KEEP_CONTENT default(true)  ->  <p>Hello</p>   fine
   *   no #text, KEEP_CONTENT: false         ->  <p></p>        ALL TEXT GONE
   *   WITH #text, KEEP_CONTENT: false       ->  <p>Hello</p>   fine
   *
   * An earlier version of this file omitted it, and sanitising the real content
   * dropped 49% of its bytes — every tag intact, every word gone.
   */
  '#text',

  // Structure
  'div', 'span', 'p', 'br', 'hr', 'section', 'article',
  // Headings — h4/h5 dominate the real content, but allow the full range
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Lists
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // Inline formatting
  'a', 'strong', 'b', 'em', 'i', 'u', 's', 'small', 'sub', 'sup', 'mark',
  // Tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  // ⚠️ Collapsible sections. 52 uses each in existing content — a generic allow-list
  // omits these and the widgets silently stop working.
  'details', 'summary',
  // Quotes and code
  'blockquote', 'code', 'pre', 'kbd', 'q', 'cite',
  // Images. Not currently used by any row, but obviously desirable in a rich-text
  // editor; omitting it would mean the first image an admin inserts vanishes without
  // explanation. `src` is constrained by ALLOWED_URI_REGEXP below.
  'img', 'figure', 'figcaption',
]

/**
 * Attributes permitted on those tags.
 *
 * ⚠️ NOTE WHAT IS ABSENT: every `on*` event handler. That is not an oversight and must
 * not be "fixed" — see the block comment on `sanitizeRichTextHtml` below.
 */
const ALLOWED_ATTR = [
  // The workhorse: 28,608 uses. See the reasoning above.
  'style',
  // Tailwind utility classes, 44 uses.
  'class',
  // Links. `target` is always "_blank" in existing content; `rel` is added
  // automatically by the hook below.
  'href', 'target', 'rel', 'title',
  // Images
  'src', 'alt', 'width', 'height', 'loading',
  // Tables
  'colspan', 'rowspan', 'scope',
  // <details open>
  'open',
  // Anchor targets for in-page links
  'id',
]

/**
 * Which URL schemes may appear in `href` and `src`.
 *
 * The scan found only `https` (525) and `http` (65) in existing content. `mailto:`,
 * `tel:` and root-relative links are permitted too as obviously-legitimate additions.
 *
 * ⚠️ What this deliberately blocks:
 *   - `javascript:` — direct script execution on click
 *   - `data:` — `data:text/html;base64,…` is a classic XSS vector
 *   - `vbscript:`, and anything else not named here
 *
 * DOMPurify blocks `javascript:` on its own; pinning the regex means a future config
 * change cannot loosen it by accident.
 */
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|tel:|#|\/)/i

/**
 * Add `rel="noopener noreferrer"` to every link that opens in a new tab.
 *
 * All 541 `target` attributes in the existing content are `_blank`, and NONE has a
 * `rel`. Without `rel="noopener"`, the opened page can reach back through
 * `window.opener` and navigate the original tab — a phishing vector. Modern browsers
 * imply `noopener` for `target="_blank"`, so this is belt-and-braces rather than a
 * live hole, but it costs nothing and `noreferrer` also stops leaking the referring
 * URL to the destination.
 *
 * Registered once at module scope. DOMPurify hooks are global, so re-adding this on
 * every call would stack duplicate handlers.
 */
/**
 * CSS constructs that must never survive inside a `style` attribute.
 *
 * ⚠️ DOMPurify does NOT deeply parse CSS. It relies on the browser's own CSS parser
 * discarding invalid declarations, which handles most cases — but it means a `style`
 * value reaches the page largely as written. Since `style` is allowed here (28,608
 * uses, unavoidable), these three get scrubbed explicitly:
 *
 *   expression(…)  legacy IE only, but it executed arbitrary JavaScript from CSS
 *   behavior:      legacy IE, loaded an .htc script file
 *   javascript:    inside url(). Modern browsers do not execute this, so it is a
 *                  theoretical hole rather than a live one — scrubbed anyway because
 *                  it costs nothing and "modern browsers don't" is a weak guarantee
 *                  to rest on.
 */
// ⚠️ NO `g` FLAG. With /g, `RegExp.test()` is STATEFUL — it advances `lastIndex` and
// resumes from there on the next call, so alternating inputs make it miss matches it
// should catch. An earlier version used /gi and silently failed to strip
// `expression(...)` because a previous call had left `lastIndex` past it. Only boolean
// tests are needed here, so the flag was never required.
const DANGEROUS_CSS = /expression\s*\(|behaviou?r\s*:|javascript\s*:|vbscript\s*:|-moz-binding/i

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // Duck-typed rather than `node instanceof Element`. On the server, DOMPurify runs
  // against jsdom, where `Element` is not a Node global — an `instanceof` check there
  // throws a ReferenceError inside the hook and takes the whole sanitise call with it.
  if (!('tagName' in node) || typeof node.setAttribute !== 'function') return

  // Links that open a new tab get rel="noopener noreferrer" — see the note below.
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }

  // Scrub dangerous CSS. Individual DECLARATIONS are dropped rather than the whole
  // attribute, so one bad value cannot flatten a page's entire layout.
  const style = node.getAttribute?.('style')
  if (style && DANGEROUS_CSS.test(style)) {
    const cleaned = style
      .split(';')
      .filter((decl) => decl.trim() !== '' && !DANGEROUS_CSS.test(decl))
      .join(';')
    if (cleaned.trim()) node.setAttribute('style', cleaned)
    else node.removeAttribute('style')
  }
})

/**
 * Clean admin-authored HTML before it is stored.
 *
 * ============================================================================
 * ⚠️ EVERY `on*` EVENT HANDLER IS REMOVED. THIS IS DELIBERATE.
 * ============================================================================
 * The existing content contains 398 of them — `onmouseover` and `onmouseout` on links
 * in 4 pages, used for a hover colour change:
 *
 *     <a href="…" style="color: #767c7c;"
 *        onmouseover="this.style.color='#000000';"
 *        onmouseout="this.style.color='#767c7c';">YouTube</a>
 *
 * Those are benign — they were authored deliberately, not injected. But an allow-list
 * cannot distinguish a harmless `onmouseover` from
 * `onmouseover="fetch('/api/admin/users',{method:'POST',…})"`. Permitting event
 * handlers is permitting arbitrary JavaScript, which defeats the entire purpose of
 * sanitising. So they go, without exception.
 *
 * **The hover effect is replaced by CSS**, in `src/app/globals.css`:
 *
 *     .rich-text-content a:hover { color: #000 !important; }
 *
 * `!important` is required because an inline `style="color: …"` beats a stylesheet
 * rule on specificity. The result is better than the original: it applies to every
 * link consistently instead of only the 4 pages that happened to have the handlers.
 *
 * ⚠️ Because sanitisation happens on WRITE, the 398 existing handlers stay in the
 * database until those pages are next saved. They are harmless in the meantime, and
 * the CSS rule means the hover keeps working before and after. No data migration
 * needed — but if you want them gone immediately, re-saving those 4 pages does it.
 *
 * @param html Raw HTML from the admin editor.
 * @returns HTML safe to store and to render with `dangerouslySetInnerHTML`.
 */
export function sanitizeRichTextHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,

    /**
     * ⚠️ REQUIRED, or `ALLOWED_URI_REGEXP` silently deletes `target` from all 541
     * links.
     *
     * DOMPurify validates every attribute it considers URI-bearing against
     * `ALLOWED_URI_REGEXP`. `target` is in that set, and `_blank` obviously does not
     * match `^(?:https?:|mailto:|tel:|#|\/)` — so the attribute is dropped even though
     * `target` is explicitly listed in ALLOWED_ATTR.
     *
     * `ADD_URI_SAFE_ATTR` marks it as not-a-URI so it skips that check. Confirmed that
     * this does NOT weaken the regex for real URLs: `href="javascript:alert(1)"` is
     * still stripped with this set.
     *
     * (Note `target` is not in DOMPurify's default ALLOWED_ATTR either, so listing it
     * above is what permits it at all — two separate hurdles for one attribute.)
     */
    ADD_URI_SAFE_ATTR: ['target'],
    // Drop the element AND its text when it is disallowed. Without this,
    // `<script>alert(1)</script>` leaves the literal text `alert(1)` behind as a
    // visible artefact on the page.
    KEEP_CONTENT: false,
    // Return a string, not a DOM node — we are storing it.
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,

    // ⚠️ DO NOT ADD `USE_PROFILES` HERE.
    //
    // `USE_PROFILES` is MUTUALLY EXCLUSIVE with ALLOWED_TAGS / ALLOWED_ATTR — setting
    // it makes DOMPurify ignore both lists above and substitute its own. An earlier
    // version of this file set `USE_PROFILES: { html: true }` intending to block SVG
    // and MathML, and the effect was the opposite of what was wanted:
    //
    //   - `target` was stripped from all 541 links, because the built-in profile
    //     does not include it
    //   - `<form>` and `<input>` SURVIVED, because the profile does allow them
    //
    // Neither showed up until the allow-list was tested against the real content.
    // SVG and MathML are already excluded simply by not being in ALLOWED_TAGS, so the
    // option was never needed.
  })
}

/**
 * Plain text extracted from sanitised HTML, for the `RichTextContent.plainText`
 * column (used for search) and for word counts.
 *
 * Runs on the SANITISED html so anything already stripped cannot leak into the text
 * layer — e.g. the contents of a removed `<script>`.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|tr|br|summary|details)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    // `&amp;` last, or "&amp;lt;" would double-decode into "<".
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
