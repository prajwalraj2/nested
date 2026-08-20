// src/lib/image-processing.ts

import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { OutputInfo } from 'sharp';

/**
 * Turning an upload into a table thumbnail (K-5a).
 * ============================================================================
 *
 * ⚠️ SEPARATE FROM THE ROUTE ON PURPOSE. The route is auth, parsing and database work; this
 * is the part with the security decisions in it, and it is pure — bytes in, bytes out — so it
 * can be tested directly without a server, a session or a Blob token.
 *
 * ── The threat, stated plainly ─────────────────────────────────────────────────
 * #27.5 recorded that stored SVGs are only dangerous when uploads are accepted, and noted
 * that icons in the repository therefore carried no such risk. **This is the case that
 * correction was about.** An upload endpoint takes bytes from a browser and serves them back
 * to other people's browsers, so the file must be treated as hostile.
 *
 * The defences, in the order they apply:
 *
 *   1. **A size cap before decoding.** A 200-byte file can expand to gigabytes of pixels — a
 *      decompression bomb — so the limit is checked on the encoded bytes, before sharp is
 *      handed anything.
 *   2. **A pixel cap.** The byte cap alone is not enough: a legitimately small PNG can still
 *      declare 50,000×50,000. `limitInputPixels` makes sharp refuse rather than allocate.
 *   3. **Magic bytes, not the extension or the declared MIME type.** Both are supplied by the
 *      client and neither is evidence. A file named `.png` proves nothing.
 *   4. **SVG rejected outright.** It is a document format that can carry script, and no
 *      amount of re-encoding makes accepting one from a stranger sensible.
 *   5. ⚠️ **Re-encoding, which is the real defence.** Everything above is a filter, and
 *      filters can be evaded. Decoding to raw pixels and re-encoding as WebP discards
 *      *everything* that is not image data — trailing payloads, EXIF, colour profiles,
 *      polyglot headers — rather than trying to detect it. **Detection can be fooled;
 *      re-encoding cannot.** It also strips GPS coordinates from anything screenshotted on a
 *      phone, which nobody would have thought to ask for.
 */

/** Encoded upload ceiling. Generous — the user was told not to resize before uploading. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Output edge, in pixels.
 *
 * ⚠️ 64, not 32. The thumbnail renders at 32 CSS pixels, and a retina display asks for two
 * device pixels per CSS pixel — a 32px source would be visibly soft on most laptops and every
 * phone. The cost of the larger source is nothing: about 2 KB as WebP.
 */
export const OUTPUT_SIZE = 64;

/** Refuse anything claiming more pixels than this before allocating for it. */
const MAX_INPUT_PIXELS = 40_000_000; // ~6300 × 6300

/**
 * What an upload is being processed FOR (M-9).
 * ============================================================================
 *
 * ⚠️ ONE PIPELINE, TWO SHAPES — NOT TWO PIPELINES. The rules that matter are the ones above and
 * below this line: the magic-byte sniff, the SVG and GIF rejections, the pixel ceiling, the
 * re-encode that destroys anything embedded in the original. Duplicating those for blog covers is
 * how one copy quietly stops rejecting SVGs. Only the output geometry differs, so only the output
 * geometry is parameterised.
 *
 * ⚠️ THE PLAN SAID "ONE UPLOAD ENDPOINT WITH A PRESET", AND THAT WAS NOT QUITE RIGHT. The existing
 * endpoint is `/api/admin/table-images`, whose job includes WRITING A `TableImage` ROW and
 * returning its id — a blog cover has no such row, because `BlogPost.coverUrl` stores a URL
 * directly (the key indirection earns its keep at 1.68x reuse, and a cover belongs to one post).
 * A route that sometimes writes a row and sometimes does not, keyed on a query parameter, is worse
 * than two thin routes over one shared pipeline. So the PRESET lives here and the routes stay
 * separate.
 */
export type ImagePreset = 'table-icon' | 'blog-cover';

type PresetSpec = {
  width: number;
  height: number;
  fit: 'contain' | 'cover';
  format: 'webp' | 'jpeg';
  contentType: 'image/webp' | 'image/jpeg';
  /** Transparent padding for `contain`; ignored by `cover`. */
  background: { r: number; g: number; b: number; alpha: number };
  withoutEnlargement: boolean;
};

const PRESETS: Record<ImagePreset, PresetSpec> = {
  /**
   * A logo beside a table row. Unchanged from the original hard-coded behaviour.
   *
   * `contain`, not `cover`: a logo cropped to a square loses the parts that identify it — `cover`
   * slices the ends off a wordmark. The padding is transparent so it disappears against any row
   * background, in either theme.
   */
  'table-icon': {
    width: OUTPUT_SIZE,
    height: OUTPUT_SIZE,
    fit: 'contain',
    format: 'webp',
    contentType: 'image/webp',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    withoutEnlargement: true,
  },

  /**
   * A blog cover, sized for a social card.
   *
   * ⚠️ 1200x630 IS THE OPEN GRAPH RATIO (1.91:1), not an arbitrary large number. Off-ratio images
   * get cropped by each platform differently, so the crop is done here where it can be seen.
   *
   * ⚠️ `cover`, NOT `contain` — the opposite call to the icon above, and deliberately so. A padded
   * social card shows bars down the sides in every feed. A photograph loses its edges to a crop and
   * survives; a wordmark does not, which is why the icon preset chose the other way.
   *
   * ⚠️ JPEG, NOT WEBP, AND THIS IS THE ONE CHOICE MOST LIKELY TO LOOK WRONG. WebP is smaller and
   * every browser reads it — but this image's main job is `og:image`, and WebP support across
   * social platforms is uneven. A cover that renders perfectly on the site and produces a blank
   * card on X is a bad trade for a few kilobytes. Revisit only with the platforms re-checked.
   *
   * ⚠️ `withoutEnlargement: false`, unlike the icon. A 600px-wide source SHOULD be scaled up to
   * fill the card: a small centred image with the rest cropped away is worse than a slightly soft
   * one. The icon preset chose the opposite because a 16px favicon must stay crisp.
   */
  'blog-cover': {
    width: 1200,
    height: 630,
    fit: 'cover',
    format: 'jpeg',
    contentType: 'image/jpeg',
    background: { r: 255, g: 255, b: 255, alpha: 1 },
    withoutEnlargement: false,
  },
};

export type ProcessedImage = {
  buffer: Buffer;
  /** Content hash of the OUTPUT, which becomes the object name. */
  hash: string;
  width: number;
  height: number;
  bytes: number;
  contentType: 'image/webp' | 'image/jpeg';
};

export class ImageRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageRejected';
  }
}

/**
 * What the bytes actually are, read from their leading signature.
 *
 * ⚠️ Deliberately a small allow-list rather than a deny-list of dangerous formats. A
 * deny-list has to anticipate every hostile format that will ever exist; an allow-list only
 * has to name the few that are wanted.
 */
export function sniffFormat(buffer: Buffer): 'png' | 'jpeg' | 'webp' | 'gif' | 'svg' | 'unknown' {
  if (buffer.length < 12) return 'unknown';

  if (buffer[0] === 0x89 && buffer.subarray(1, 4).toString('ascii') === 'PNG') return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'webp';
  if (buffer.subarray(0, 3).toString('ascii') === 'GIF') return 'gif';

  /*
    SVG is text, so it has no signature — it is identified by looking at the start of the
    content. Checked case-insensitively and after leading whitespace, an XML declaration or a
    DOCTYPE, because all of those legitimately precede the `<svg` tag and none of them make
    the file safe.
  */
  const head = buffer.subarray(0, 1024).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml') || head.startsWith('<!doctype svg')) {
    return 'svg';
  }

  return 'unknown';
}

/**
 * Validate, resize and re-encode.
 *
 * @throws {ImageRejected} with a message meant to be shown to the person uploading.
 */
export async function processUpload(
  input: Buffer,
  /*
    ⚠️ DEFAULTS TO `table-icon` SO EVERY EXISTING CALLER IS UNCHANGED. `table-images/route.ts` was
    written before presets existed and still passes one argument; making the parameter required
    would have meant editing a working upload path to add a value it already had.
  */
  preset: ImagePreset = 'table-icon'
): Promise<ProcessedImage> {
  const spec = PRESETS[preset];
  if (input.length === 0) throw new ImageRejected('That file is empty.');
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new ImageRejected(
      `That file is ${(input.length / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    );
  }

  const format = sniffFormat(input);

  if (format === 'svg') {
    throw new ImageRejected(
      'SVG files are not accepted. Upload a PNG or JPG — the server converts it to WebP.',
    );
  }
  if (format === 'gif') {
    throw new ImageRejected(
      'GIF files are not accepted. Animation is not visible at this size; upload a PNG or JPG.',
    );
  }
  if (format === 'unknown') {
    // Says what was checked, so "but it IS a png" has an answer: the bytes disagree.
    throw new ImageRejected(
      'That file is not a PNG, JPG or WebP. The check reads the file itself, not its name.',
    );
  }

  let processed: { data: Buffer; info: OutputInfo };
  try {
    const pipeline = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // Honour the EXIF orientation BEFORE the metadata is discarded below.
      /*
        Geometry comes from the preset — see `PRESETS` above for why each field differs between a
        table icon and a blog cover. Everything around this call is identical for both.
      */
      .resize(spec.width, spec.height, {
        fit: spec.fit,
        background: spec.background,
        withoutEnlargement: spec.withoutEnlargement,
      });

    /*
      ⚠️ `flatten` BEFORE JPEG, BECAUSE JPEG HAS NO ALPHA CHANNEL. Without it, a PNG with a
      transparent background encodes with BLACK where the transparency was — which on a social card
      reads as a rendering failure rather than a design choice. The WebP path keeps its alpha and
      must NOT be flattened.

      Written as a branch rather than a chained expression: the two formats take different option
      objects, and expressing that inline means indexing sharp by a computed method name, which
      TypeScript cannot check and a reader has to decode.
    */
    const encoded =
      spec.format === 'jpeg'
        ? pipeline.flatten({ background: spec.background }).jpeg({ quality: 82, mozjpeg: true })
        : pipeline.webp({ quality: 90, effort: 4 });

    processed = await encoded.toBuffer({ resolveWithObject: true });
  } catch (error) {
    /*
      sharp throws for a corrupt file, an unsupported variant, or the pixel limit. The
      original message names internal paths and codec details, so it is logged rather than
      returned.
    */
    console.error('[table-images] sharp failed:', error);
    throw new ImageRejected('That image could not be read. It may be corrupt or an unusual variant.');
  }

  /*
    ⚠️ HASH THE OUTPUT, NOT THE INPUT.

    Two different source files that resize to identical thumbnails should share one object —
    and, more importantly, the hash must describe the bytes actually being served. Hashing
    the input would let a change in the encoder produce different stored bytes under a URL
    that browsers have cached for a year as immutable.
  */
  const hash = createHash('sha256').update(processed.data).digest('hex').slice(0, 16);

  return {
    buffer: processed.data,
    hash,
    width: processed.info.width,
    height: processed.info.height,
    bytes: processed.data.length,
    contentType: spec.contentType,
  };
}

/**
 * Normalise a human-typed key into the id rows will reference.
 *
 * Same convention as `public/icons/` filenames — lowercase, hyphens — because contributors
 * meet both systems and two rules would be one too many. Documented in `ICON-GUIDE.md` §4.
 */
export function normaliseImageKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function isValidImageKey(key: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(key) && key.length >= 2 && key.length <= 64;
}
