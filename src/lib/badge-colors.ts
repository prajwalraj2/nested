// src/lib/badge-colors.ts

/**
 * Badge colours for table cells (K-1, #29.3 / #29.6b).
 * ============================================================================
 *
 * ⚠️ WHAT THIS REPLACES, AND WHY IT WAS BROKEN
 * --------------------------------------------
 * The old rule in `DataTable.tsx` was one line:
 *
 *     const colorIndex = String(value).toLowerCase().charCodeAt(0) % badgeColors.length;
 *
 * The colour came from the **first character** of the text, mod 5. Not the meaning of the
 * value — the letter. So on the live site:
 *
 *     "Free to Audit"  f = 102  ->  102 % 5 = 2  ->  yellow
 *     "Free Course"    f = 102  ->              ->  yellow
 *     "Paid Course"    p = 112  ->  112 % 5 = 2  ->  yellow   ← free and paid, identical
 *
 *     "English"        e = 101  ->  101 % 5 = 1  ->  green
 *     "Only Music"     o = 111  ->  111 % 5 = 1  ->  green    ← unrelated, identical
 *
 * Measured across the whole database: **296 badge columns, 155 with two values colliding,
 * and 75 where every value in the column rendered the same colour.** In those 75 the badge
 * carried no information at all.
 *
 * ⚠️ WHY NOT JUST HASH THE WHOLE VALUE?
 * -------------------------------------
 * That was the first proposal and it is **not good enough**. Hashing fixes the first-letter
 * bug but only makes collisions *unlikely*, never impossible — and with a small palette
 * "unlikely" is not what happens:
 *
 *     5 distinct values into 10 colour buckets, chosen independently:
 *     P(no collision) = (10·9·8·7·6) / 10^5 = 0.302
 *                                          -> ~70% of such columns STILL collide
 *
 * The requirement is that distinct values get distinct colours. Only assigning by
 * **position** delivers that: take the column's distinct values, hand out colour 0, 1, 2…
 * in order. Uniqueness stops being probabilistic and becomes structural.
 *
 * ⚠️ HOW MANY COLOURS — AND WHY UNIQUENESS IS PER-COLUMN
 * ------------------------------------------------------
 * Uniqueness only has to hold **inside a single column**. Nobody compares the Pricing badge
 * on the Courses table against the Language badge on the YouTube table — they are different
 * tables on different pages. So the palette needs to be as large as the *widest single
 * column*, not as large as the site-wide set of values.
 *
 *     distinct values in one badge column:   1 -> 47 columns
 *                                            2 -> 125
 *                                            3 -> 72
 *                                            4 -> 46
 *                                            5 -> 6      ← the maximum anywhere
 *
 *     62 distinct badge values exist across the entire site.
 *     NO column holds more than 5.
 *
 * Ten gives double headroom over anything that exists. Past ten it wraps and colours repeat
 * — but a badge column with eleven categories is free text, not a badge column.
 */

/**
 * The palette, in assignment order. **Order is not decorative** — it decides what most of
 * the site looks like.
 *
 * 125 of the 296 badge columns hold exactly two values, so positions 0 and 1 are what the
 * majority of tables actually render. `emerald` then `amber` is deliberate: the two-value
 * columns in this data are overwhelmingly free/paid, yes/no, available/unavailable — pairs
 * where "good, then caution" is the reading people already expect.
 *
 * Positions 5–9 are only reached by a column with six or more values, of which there are
 * currently **zero**; they exist as headroom, not as a design statement.
 */
export const BADGE_COLORS = [
  'emerald',
  'amber',
  'sky',
  'violet',
  'rose',
  'teal',
  'indigo',
  'orange',
  'pink',
  'slate',
] as const;

export type BadgeColor = (typeof BADGE_COLORS)[number];

/**
 * ⚠️ EVERY CLASS STRING IS WRITTEN OUT IN FULL. THIS IS NOT VERBOSITY.
 *
 * Tailwind builds its stylesheet by **scanning source files for literal class strings**. It
 * never evaluates the code. So this, which is what you would naturally write:
 *
 *     `bg-${color}-100 text-${color}-800`      // ❌ produces NO CSS AT ALL
 *
 * compiles to nothing — Tailwind sees a template literal, not `bg-emerald-100`, and emits no
 * rule. The badge would render with no background, and only at runtime, only in production,
 * only for the colours that happened not to be used elsewhere in the app.
 *
 * A lookup table of complete literals is the fix, and it is why this object is long.
 *
 * ── Both themes ────────────────────────────────────────────────────────────────
 * Dark mode here is class-based — `globals.css` declares
 * `@custom-variant dark (&:is(.dark *))` — so the `dark:` prefix keys off a `.dark`
 * ancestor rather than the OS setting.
 *
 * The dark values are chosen, not inverted: a deep tinted ground (`-950`) with a light
 * foreground (`-300`). Simply flipping the light values would put `-100` backgrounds on a
 * dark page and glare.
 *
 * ── Shape ──────────────────────────────────────────────────────────────────────
 * Tinted ground + readable foreground + a one-pixel border, rather than today's solid
 * saturated fill with pale text. The border is what keeps a pale badge legible against a
 * card that is nearly the same lightness.
 */
export const BADGE_COLOR_CLASSES: Record<BadgeColor, string> = {
  emerald:
    'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  amber:
    'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  sky:
    'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
  violet:
    'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
  rose:
    'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
  teal:
    'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
  indigo:
    'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
  orange:
    'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  pink:
    'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800',
  slate:
    'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
};

/** Human labels, for the colour picker the admin editor gets in K-6. */
export const BADGE_COLOR_LABELS: Record<BadgeColor, string> = {
  emerald: 'Green',
  amber: 'Amber',
  sky: 'Blue',
  violet: 'Violet',
  rose: 'Red',
  teal: 'Teal',
  indigo: 'Indigo',
  orange: 'Orange',
  pink: 'Pink',
  slate: 'Grey',
};

/** Narrowing guard — a stored override is arbitrary JSON until proven otherwise. */
export function isBadgeColor(value: unknown): value is BadgeColor {
  return typeof value === 'string' && (BADGE_COLORS as readonly string[]).includes(value);
}

/**
 * Normalise a raw cell value to the key used for colour lookup.
 *
 * Cells arrive as `unknown` — the row is `{ [columnId]: unknown }` — so this is where a
 * number, boolean or stray whitespace becomes a comparable string. Trimming matters because
 * `"Free Course"` and `"Free Course "` are the same category to a reader, and giving them
 * two different colours would look exactly like the bug this file exists to fix.
 */
export function normaliseBadgeValue(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * Assign one colour per distinct value in a single column.
 *
 * @param values every cell value in that column (duplicates and blanks welcome)
 * @returns      normalised value -> colour, guaranteed distinct up to 10 values
 *
 * ⚠️ SORTED, AND WITH A PLAIN COMPARISON — NOT `localeCompare`.
 * ------------------------------------------------------------
 * Two separate reasons, and both are the kind of bug that only shows up later:
 *
 * 1. **Sorted rather than first-seen.** First-appearance order would tie the colours to the
 *    order of rows in the JSON blob, so re-importing the same CSV with the rows shuffled
 *    would silently repaint every badge in the table.
 *
 * 2. **`<` rather than `localeCompare`.** `localeCompare` is locale-dependent, and this
 *    renders on the server and then hydrates in the browser. If the two disagree about the
 *    order of two values, they disagree about the colours, and React reports a hydration
 *    mismatch. Code-unit comparison is identical everywhere.
 *
 * Adding a new value still shifts the colours of everything after it alphabetically — which
 * is exactly why K-6 stores the result in `col.meta.badgeColors` rather than recomputing it
 * forever. Once stored, a new value takes the next free colour and nothing else moves.
 */
export function assignBadgeColors(values: readonly unknown[]): Record<string, BadgeColor> {
  const distinct = Array.from(
    new Set(values.map(normaliseBadgeValue).filter((v) => v !== '')),
  ).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const assignment: Record<string, BadgeColor> = {};
  distinct.forEach((value, index) => {
    // Wraps past the tenth value. No column in the data comes close, but a wrap is a
    // repeated colour rather than `undefined`, which would render an unstyled badge.
    assignment[value] = BADGE_COLORS[index % BADGE_COLORS.length];
  });
  return assignment;
}

/**
 * The colour for one cell, honouring a stored override.
 *
 * Precedence: **stored wins.** `col.meta.badgeColors` is set by an admin in K-6 to express
 * something the automatic assignment cannot know — that "Paid" ought to be amber
 * specifically, rather than whatever position it happens to occupy alphabetically.
 *
 * ⚠️ An unrecognised stored value falls back rather than throwing. That column's `meta` is
 * arbitrary JSON from the database; a typo or a value left over from an older palette must
 * degrade to a sensible colour, not blank the badge.
 */
export function resolveBadgeColor(
  value: unknown,
  computed: Record<string, BadgeColor>,
  stored?: Record<string, string> | null,
): BadgeColor {
  const key = normaliseBadgeValue(value);

  const override = stored?.[key];
  if (isBadgeColor(override)) return override;

  // `slate` is the fallback for a value absent from the assignment — which happens when a
  // cell is filtered out of the source the assignment was built from. Neutral by design: it
  // reads as "uncategorised" rather than claiming a meaning it does not have.
  return computed[key] ?? 'slate';
}

/** Ready-to-use class string for a cell. */
export function badgeClassFor(
  value: unknown,
  computed: Record<string, BadgeColor>,
  stored?: Record<string, string> | null,
): string {
  return BADGE_COLOR_CLASSES[resolveBadgeColor(value, computed, stored)];
}
