/**
 * Renders a schema.org JSON-LD block.
 * ============================================================================
 *
 * ⚠️ WHY `dangerouslySetInnerHTML` IS UNAVOIDABLE HERE
 *
 * The obvious version does not work:
 *
 *     <script type="application/ld+json">{JSON.stringify(data)}</script>
 *
 * React escapes text children, so `<` becomes `&lt;` and `&` becomes `&amp;` INSIDE the
 * script body. HTML entity escaping is meaningless to a JSON parser, so the block
 * arrives corrupted and Google silently discards it — the markup looks present in
 * devtools but fails validation. `dangerouslySetInnerHTML` is the only way to emit a
 * script body verbatim.
 *
 * ⚠️ WHY THAT IS SAFE HERE — and the one thing that makes it safe
 *
 * The input is never user HTML: it is `JSON.stringify` of an object built on the server
 * in `src/lib/structured-data.ts`. But it DOES contain admin-authored page titles, and
 * inside a `<script>` element the HTML parser hunts for the literal bytes `</script`
 * without caring that they sit inside a JSON string. A title containing
 * `</script><script>…` would break out of the block.
 *
 * `escapeForScriptTag` in structured-data.ts escapes `<` and `>` to `<` / `>`
 * before this point, which keeps the JSON semantically identical while making that byte
 * sequence impossible to produce. **The safety lives there, not here** — so if this
 * component is ever reused with data from elsewhere, that escaping must be applied
 * first.
 *
 * Accepts `null` so callers can pass a builder result straight through:
 * `buildBreadcrumbJsonLd` returns `null` for trails too short to be worth emitting, and
 * rendering nothing is better than an empty script tag.
 */
export function JsonLd({ data }: { data: object | null }) {
  if (!data) return null

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
