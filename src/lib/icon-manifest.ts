// ⚠️ GENERATED FILE — DO NOT EDIT.
//
// Written by scripts/generate-icon-manifest.mjs from the contents of public/icons/,
// as a `prebuild` step. Editing it by hand will be silently undone by the next build.
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

export const ICON_MANIFEST: IconManifestEntry[] = [
  {
    "id": "discord",
    "url": "/icons/discord.svg",
    "label": "Discord",
    "bytes": 1389
  },
  {
    "id": "facebook",
    "url": "/icons/facebook.svg",
    "label": "Facebook",
    "bytes": 557
  },
  {
    "id": "github",
    "url": "/icons/github.svg",
    "label": "GitHub",
    "bytes": 837
  },
  {
    "id": "google-chrome-extension",
    "url": "/icons/google-chrome-extension.svg",
    "label": "Google Chrome Extension",
    "bytes": 3136
  },
  {
    "id": "instagram",
    "url": "/icons/instagram.svg",
    "label": "Instagram",
    "bytes": 2116
  },
  {
    "id": "linkedin",
    "url": "/icons/linkedin.svg",
    "label": "LinkedIn",
    "bytes": 1316
  },
  {
    "id": "reddit",
    "url": "/icons/reddit.svg",
    "label": "Reddit",
    "bytes": 1248
  },
  {
    "id": "ted",
    "url": "/icons/ted.svg",
    "label": "TED",
    "bytes": 418
  },
  {
    "id": "youtube",
    "url": "/icons/youtube.svg",
    "label": "YouTube",
    "bytes": 474
  }
];

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
 * The value ends up in an `src` attribute. An unrecognised id would render a broken image with
 * no error anywhere — the same silent-failure shape as an unvalidated status enum.
 */
export function isValidIconId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}
