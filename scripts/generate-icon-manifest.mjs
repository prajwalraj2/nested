/**
 * Generates `src/lib/icon-manifest.ts` from whatever SVGs are in `public/icons/`.
 * ============================================================================
 *
 * Runs as `prebuild` (see package.json), so the manifest cannot be stale in a deployed build.
 *
 * WHY GENERATE IT AT ALL, rather than hand-maintaining a list?
 * -----------------------------------------------------------
 * Because a hand-maintained list of values is exactly the thing this project keeps getting
 * wrong. The status filter in #24 was written out by hand and silently offered two of three
 * options for a whole release; `buildPageHierarchy` rebuilds pages from a hand-written field
 * list and silently dropped `status` in #25. Neither errored — they just quietly did less than
 * they appeared to.
 *
 * A list derived from the folder cannot disagree with the folder. Adding an icon is one file.
 *
 * WHY A GENERATED .ts FILE, rather than reading the directory at runtime?
 * ----------------------------------------------------------------------
 * Reading `public/` from a server component would work locally and be unreliable on Vercel's
 * serverless runtime, where the filesystem available to a function is not simply the repository.
 * A generated module is a plain import: it works identically in dev, in build, and at runtime,
 * and it is type-checked.
 */

import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIR = join(ROOT, 'public', 'icons');
const OUT_FILE = join(ROOT, 'src', 'lib', 'icon-manifest.ts');

/**
 * ⚠️ THE SIZE CEILING IS ENFORCED, NOT DOCUMENTED.
 *
 * A README rule is advice; a failing build is a rule. Real coloured brand logos measure
 * 418–2,116 bytes, so 10 KB is a generous ceiling that only an accident can exceed — a raster
 * image wrapped in an SVG, or a logo carrying detail invisible at 20 pixels.
 *
 * Twenty icons at 500 KB would be 10 MB on a single page. That is the failure this prevents.
 */
const MAX_BYTES = 10 * 1024;

/**
 * Turn `youtube.svg` into `YouTube`… as far as a script reasonably can.
 *
 * ⚠️ This is a STARTING POINT, not a naming authority. `youtube` becomes `Youtube`, which is not
 * how the brand writes it. The label is only what the admin picker shows, so a slightly wrong
 * capitalisation is cosmetic — but if it matters, the fix is `LABEL_OVERRIDES` below rather than
 * cleverer parsing, because there is no rule that recovers `YouTube` from `youtube`.
 */
const LABEL_OVERRIDES = {
  // Brands whose own capitalisation cannot be recovered from a lowercase filename.
  // Add a line here whenever a new icon's auto-generated label reads wrongly.
  github: 'GitHub',
  linkedin: 'LinkedIn',
  ted: 'TED',
  youtube: 'YouTube',
};

function toLabel(id) {
  if (LABEL_OVERRIDES[id]) return LABEL_OVERRIDES[id];
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function main() {
  // An empty or missing folder is a legitimate state — it is what this repository looks like
  // before the first icon is added — so it produces an empty manifest, not an error.
  const files = existsSync(ICONS_DIR)
    ? readdirSync(ICONS_DIR).filter((f) => extname(f).toLowerCase() === '.svg')
    : [];

  const oversized = [];
  const icons = [];

  for (const file of files.sort()) {
    const bytes = statSync(join(ICONS_DIR, file)).size;
    if (bytes > MAX_BYTES) {
      oversized.push({ file, bytes });
      continue;
    }
    const id = basename(file, '.svg');
    icons.push({ id, url: `/icons/${file}`, label: toLabel(id), bytes });
  }

  if (oversized.length > 0) {
    console.error('\n✗ Icon size limit exceeded — build stopped.\n');
    for (const { file, bytes } of oversized) {
      console.error(
        `    public/icons/${file}  ${(bytes / 1024).toFixed(1)} KB  (limit ${MAX_BYTES / 1024} KB)`
      );
    }
    console.error(
      '\n  A 20px icon should be roughly 0.5–2 KB. Something this large is usually a raster\n' +
        '  image wrapped in an SVG. See public/icons/README.md.\n'
    );
    // ⚠️ Non-zero exit, so `npm run build` stops here. Warning and continuing would let the
    // oversized file reach production, which is the entire thing this guards against.
    process.exit(1);
  }

  const body = `// ⚠️ GENERATED FILE — DO NOT EDIT.
//
// Written by scripts/generate-icon-manifest.mjs from the contents of public/icons/,
// as a \`prebuild\` step. Editing it by hand will be silently undone by the next build.
//
// To add an icon: drop an SVG in public/icons/ and commit. See that folder's README.

export type IconManifestEntry = {
  /** Filename without the extension. This is what is stored in Domain.icon / Page.icon. */
  id: string;
  /** Public URL, served same-origin with immutable caching (see next.config.ts). */
  url: string;
  /** Human-readable name for the admin picker. */
  label: string;
  /** File size in bytes — shown in the picker so an oversized icon is visible before use. */
  bytes: number;
};

export const ICON_MANIFEST: IconManifestEntry[] = ${JSON.stringify(icons, null, 2)};

/**
 * Fast lookup by id, built once at module load.
 */
const BY_ID = new Map(ICON_MANIFEST.map((icon) => [icon.id, icon]));

export function getIcon(id: string | null | undefined): IconManifestEntry | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

/**
 * ⚠️ Use this to validate anything arriving from a form or an API body BEFORE storing it.
 *
 * The value ends up in an \`src\` attribute. An unrecognised id would render a broken image with
 * no error anywhere — the same silent-failure shape as an unvalidated status enum.
 */
export function isValidIconId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}
`;

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, body, 'utf8');

  const total = icons.reduce((sum, i) => sum + i.bytes, 0);
  console.log(
    `✓ icon manifest: ${icons.length} icon${icons.length === 1 ? '' : 's'}` +
      (icons.length ? ` (${(total / 1024).toFixed(1)} KB total)` : ' — public/icons/ is empty')
  );
}

main();
