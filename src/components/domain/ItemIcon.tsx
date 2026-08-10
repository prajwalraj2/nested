import { getIcon } from '@/lib/icon-manifest';

/**
 * The icon beside a domain or page name, everywhere it appears on the public site.
 * ============================================================================
 *
 * Used by all seven surfaces — the `/domain` index, section blocks, the subcategory list, both
 * "Upcoming" blocks and the two sidebar components — so sizing, alt text and spacing are decided
 * once. The `UpcomingList` lesson from I-2: two copies of near-identical markup drift the moment
 * either is touched.
 *
 * ⚠️ RENDERS NOTHING WHEN THERE IS NO ICON, rather than a placeholder. `icon` is null on
 * essentially every row today, and those rows already show an emoji inside their name — a
 * reserved gap beside them would look like a missing image on 1,200 pages. Callers therefore do
 * not need to branch: `<ItemIcon icon={page.icon} />` is safe unconditionally.
 *
 * ⚠️ NOT `next/image`, deliberately. That component exists to resize and re-encode raster
 * images; an SVG has no pixels to resize, so it would add a transform step for no benefit — and
 * these are same-origin files already served `immutable` (next.config.ts). The layout-shift
 * protection people reach for `next/image` to get comes from explicit `width`/`height`, which
 * this has.
 *
 * ⚠️ `alt=""` IS CORRECT, not an oversight. The icon sits immediately beside the name it
 * belongs to, so alt text would make a screen reader announce the same thing twice — "YouTube
 * YouTube Channels". An empty alt marks it decorative, which is exactly what it is here.
 */

type ItemIconProps = {
  /** The stored icon id, e.g. `"youtube"`. Null or an unknown id renders nothing. */
  icon: string | null | undefined;
  /**
   * Pixel size. 16 suits inline lists, 20 the slightly larger domain index rows.
   *
   * Passed as a number rather than a Tailwind class so it can be set on the `width`/`height`
   * attributes as well — those are what reserve the space before the file loads.
   */
  size?: number;
  className?: string;
};

export function ItemIcon({ icon, size = 16, className }: ItemIconProps) {
  const resolved = getIcon(icon);

  /*
    Null covers two cases, and both should render nothing:
      • no icon set — the overwhelming majority of rows, which show an emoji in their name;
      • an id that no longer resolves, because the SVG was deleted from public/icons/ while rows
        still referenced it. A broken-image glyph would be worse than silence for a visitor; the
        admin picker is where that situation is surfaced, by naming the missing id.
  */
  if (!resolved) return null;

  return (
    <img
      src={resolved.url}
      alt=""
      width={size}
      height={size}
      /*
        `shrink-0` so the icon keeps its size inside the flex rows these sit in — without it a
        long name would squash the icon rather than truncating itself.

        ⚠️ `loading="lazy"` is deliberately NOT set. These are 0.5–2 KB, above the fold on the
        pages that use them, and lazy-loading defers the request until layout settles — which
        for an icon this small costs more in delay than it saves in bytes.
      */
      className={`shrink-0${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    />
  );
}
