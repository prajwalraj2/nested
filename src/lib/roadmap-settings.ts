// src/lib/roadmap-settings.ts

/**
 * Display settings for a roadmap, resolved from the stored JSON blob.
 * ============================================================================
 *
 * The same shape as `resolveTableSettings` (K-2), and for the same reason: a JSON column means
 * new preferences cost no migration, but it also means every read has to cope with a blob that
 * predates whatever field it is looking for.
 */

export type RoadmapSettings = {
  /** Whether steps start expanded. */
  defaultExpanded: boolean;
  /** Reserved for L-9. Read but not yet acted on, so the field exists before the feature does. */
  showProgress: boolean;
};

export const ROADMAP_SETTINGS_DEFAULTS: RoadmapSettings = {
  defaultExpanded: true,
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
    defaultExpanded: s.defaultExpanded ?? ROADMAP_SETTINGS_DEFAULTS.defaultExpanded,
    showProgress: s.showProgress ?? ROADMAP_SETTINGS_DEFAULTS.showProgress,
  };
}
