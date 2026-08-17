// src/lib/roadmap-settings.ts

/**
 * Display settings for a roadmap, resolved from the stored JSON blob.
 * ============================================================================
 *
 * The same shape as `resolveTableSettings` (K-2), and for the same reason: a JSON column means
 * new preferences cost no migration, but it also means every read has to cope with a blob that
 * predates whatever field it is looking for.
 */

/*
  ⚠️ A `layout` SETTING WITH A SECOND `clustered` RENDERER LIVED HERE AND WAS DELETED (L-13).

  It existed so `clustered` and `branching` could be compared against real content rather than a
  mockup — a legitimate reason, and the comparison is what settled the design. But two renderers
  for one data shape is a standing tax: every change to the node chrome has to be made twice, and
  the copies drift. Once branching won, keeping the loser would have been carrying that cost for
  a feature nobody uses.

  Stored blobs may still contain `{ "layout": "clustered" }`. That is harmless — this resolver
  simply does not read the key, so it is inert rather than broken. No data migration needed.
*/

export type RoadmapSettings = {
  /**
   * How many top-level steps are open when someone arrives for the FIRST time.
   *
   * ⚠️ REPLACES A `defaultExpanded` BOOLEAN, and the reason is worth keeping. All-expanded
   * buried the shape of the roadmap under everything at once; all-collapsed showed the shape but
   * nothing of the substance, so the page looked empty. Opening the first two steps shows both —
   * you can see it is a tree, and you can see what a topic looks like, without scrolling past
   * eighty rows.
   *
   * ⚠️ FIRST VISIT ONLY. Once the visitor has collapsed or expanded anything, their stored state
   * wins — re-imposing a default on every visit would silently undo a deliberate choice.
   *
   * One level deep: the two steps' direct children are visible, grandchildren are not.
   */
  expandFirst: number;
  /** Reserved for L-9. Read but not yet acted on, so the field exists before the feature does. */
  showProgress: boolean;
};

export const ROADMAP_SETTINGS_DEFAULTS: RoadmapSettings = {
  expandFirst: 2,
  showProgress: false,
};

/**
 * Merge a stored blob over the defaults.
 *
 * ⚠️ `??` THROUGHOUT, NEVER `||`. This is finding #28 in miniature: `defaultExpanded: false` is a
 * deliberate, meaningful value, and `stored.defaultExpanded || true` silently turns it back into
 * `true` — the setting would appear to save and then do nothing, with no error to follow.
 *
 * ⚠️ Hand-written rather than a spread. `{ ...defaults, ...stored }` looks equivalent but copies
 * `undefined` over a default when a key is present-but-undefined, and copies unknown keys through
 * into a typed object. Naming each field means an added setting must be added here too — visible,
 * rather than silently absent.
 */
export function resolveRoadmapSettings(stored: unknown): RoadmapSettings {
  const s = (stored ?? {}) as Partial<RoadmapSettings>;
  return {
    /*
      ⚠️ Range-checked, not just defaulted. `settings` is arbitrary JSON, and a negative or
      non-numeric value would make the "which steps start open" arithmetic below produce an
      empty or absurd set with no error anywhere.
    */
    expandFirst:
      typeof s.expandFirst === 'number' && Number.isFinite(s.expandFirst) && s.expandFirst >= 0
        ? Math.floor(s.expandFirst)
        : ROADMAP_SETTINGS_DEFAULTS.expandFirst,
    showProgress: s.showProgress ?? ROADMAP_SETTINGS_DEFAULTS.showProgress,
  };
}
