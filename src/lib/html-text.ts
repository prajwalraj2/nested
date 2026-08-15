/**
 * Plain text extracted from stored HTML.
 * ============================================================================
 *
 * Used for the `RichTextContent.plainText` column (search) and for `wordCount`.
 *
 * ⚠️ THIS MOVED OUT OF `src/lib/sanitize-html.ts` WHEN THAT FILE WAS DELETED (#35).
 *
 * It lived there only because both functions were called together on the write path. It
 * never had anything to do with DOMPurify — it is pure string work with no dependencies —
 * so deleting the sanitiser would have taken `plainText` and `wordCount` down with it,
 * silently, and with no type error at the call sites that mattered. See
 * `SANITISER-REMOVAL.md` step 2.
 *
 * ⚠️ NOT THE SAME AS `htmlToText` IN `src/lib/seo.ts`. That one builds meta descriptions
 * and is deliberately separate: it truncates, collapses differently, and is tuned for a
 * ~160-character snippet rather than a full-text search column. Two similar names, two
 * different jobs — do not merge them without checking both call sites.
 *
 * ⚠️ IT NO LONGER RUNS ON SANITISED INPUT. It used to be handed the output of
 * `sanitizeRichTextHtml`, so anything stripped could not reach the search text. With the
 * sanitiser gone this receives the author's raw HTML, and the tag-stripping below is the
 * only thing standing between a `<script>` body and the `plainText` column. That is
 * acceptable — `plainText` is never rendered as HTML, only searched — but it is a change
 * in what this function can promise, and worth knowing before it is reused anywhere that
 * DOES render.
 */
export function htmlToPlainText(html: string): string {
  return html
    // Block-level closers become a space, or "…end.</p><p>Next…" would run words together.
    .replace(/<\/(p|div|h[1-6]|li|tr|br|summary|details)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    // Everything else: drop the tag, keep the text between.
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    // ⚠️ `&amp;` LAST, deliberately. Decoding it first would turn "&amp;lt;" into "&lt;"
    // and then the earlier rule would turn that into "<" — a double decode that
    // reconstructs markup out of text that was correctly escaped.
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
